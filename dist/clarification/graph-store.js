import { mkdir, readFile, readdir, unlink, open } from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { CliError, ExitCode, describeCause } from '../errors.js';
import { atomicCreateFile, atomicReplaceIfUnchanged } from './io.js';
import { loadGraphWorkspace } from './provenance.js';
import { candidateReviewEntryHash, createRelationCandidate, graphDocumentSchema, parseGraphDocument, parseRelationCandidate, relationCandidateSchema, } from '../schema/graph.js';
const graphDir = (root) => path.join(root, 'graph');
const candidateDir = (root) => path.join(graphDir(root), 'candidates');
const edgePath = (root) => path.join(graphDir(root), 'edges.yaml');
async function withGraphLock(productRoot, task) {
    await mkdir(graphDir(productRoot), { recursive: true });
    const lockPath = path.join(graphDir(productRoot), '.graph.lock');
    let lock;
    try {
        lock = await open(lockPath, 'wx', 0o600);
    }
    catch (error) {
        if (error.code === 'EEXIST')
            throw new CliError('Graph is locked by another writer.', ExitCode.USAGE_OR_IO);
        throw new CliError(`Could not acquire Graph lock: ${describeCause(error)}`, ExitCode.USAGE_OR_IO);
    }
    try {
        await lock.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
        await lock.sync();
        return await task();
    }
    finally {
        await lock.close().catch(() => undefined);
        await unlink(lockPath).catch(() => undefined);
    }
}
export async function readGraphDocument(productRoot) {
    try {
        const text = await readFile(edgePath(productRoot), 'utf8');
        return { graph: parseGraphDocument(text), text };
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return { graph: { schema_version: 1, edges: [] } };
        throw new CliError(`Could not read Graph: ${describeCause(error)}`, ExitCode.USAGE_OR_IO);
    }
}
export async function readRelationCandidates(productRoot) {
    const directory = candidateDir(productRoot);
    let files;
    try {
        files = (await readdir(directory)).filter((file) => /^RLC-[0-9a-f]{16}\.yaml$/.test(file)).sort();
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return [];
        throw new CliError(`Could not read RelationCandidates: ${describeCause(error)}`);
    }
    const candidates = [];
    for (const file of files) {
        const candidate = parseRelationCandidate(await readFile(path.join(directory, file), 'utf8'));
        if (`${candidate.id}.yaml` !== file)
            throw new CliError(`RelationCandidate filename/ID mismatch: ${file}`);
        candidates.push(candidate);
    }
    return candidates;
}
export async function addRelationCandidate(productRoot, input, now = new Date()) {
    const workspace = await loadGraphWorkspace(productRoot);
    if (workspace.schema_version !== 1)
        throw new CliError('Graph requires a v1 workspace. Run "productkit migrate" first.', ExitCode.USAGE_OR_IO);
    const sourceHash = workspace.node_snapshot_hashes.get(input.source_node_ref);
    const targetHash = workspace.node_snapshot_hashes.get(input.target_node_ref);
    if (!sourceHash || !targetHash)
        throw new CliError('RelationCandidate endpoints must resolve to current Nodes.', ExitCode.GATE_BLOCKED);
    if (input.source_node_ref === input.target_node_ref)
        throw new CliError('RelationCandidate endpoints must be distinct Nodes.', ExitCode.GATE_BLOCKED);
    const resolved = input.evidence_refs.map((entry) => {
        if (entry.kind === 'node')
            return workspace.nodes.has(entry.ref);
        if (entry.kind === 'clarification')
            return [...workspace.nodes.values()].some((record) => record.clarification_ref === entry.ref);
        if (entry.kind === 'prompt')
            return workspace.prompts.has(entry.ref);
        return [...workspace.prompts.values()].some((prompt) => prompt.spans.some((span) => span.id === entry.ref));
    });
    const missingEvidence = input.evidence_refs.filter((_entry, index) => !resolved[index]);
    if (missingEvidence.length)
        throw new CliError(`RelationCandidate evidence does not resolve: ${missingEvidence.map((entry) => entry.ref).join(', ')}`, ExitCode.GATE_BLOCKED);
    const candidate = createRelationCandidate({ ...input, endpoint_snapshot_hashes: { source: sourceHash, target: targetHash }, created_at: now.toISOString() });
    const filePath = path.join(candidateDir(productRoot), `${candidate.id}.yaml`);
    return withGraphLock(productRoot, async () => {
        await mkdir(candidateDir(productRoot), { recursive: true });
        const created = await atomicCreateFile(filePath, stringifyYaml(candidate));
        if (created)
            return { candidate, created: true };
        const existing = parseRelationCandidate(await readFile(filePath, 'utf8'));
        if (existing.candidate_hash !== candidate.candidate_hash)
            throw new CliError(`Candidate ID collision at ${filePath}; existing data was preserved.`, ExitCode.USAGE_OR_IO);
        return { candidate: existing, created: false };
    });
}
export async function reviewRelationCandidate(productRoot, id, status, userStatement, rationale, now = new Date()) {
    if (!/^RLC-[0-9a-f]{16}$/.test(id))
        throw new CliError('Invalid RelationCandidate ID.', ExitCode.USAGE_OR_IO);
    const filePath = path.join(candidateDir(productRoot), `${id}.yaml`);
    return withGraphLock(productRoot, async () => {
        const before = await readFile(filePath, 'utf8');
        const candidate = parseRelationCandidate(before);
        const base = {
            id: `RCF-${String(candidate.review_history.length + 1).padStart(3, '0')}`,
            candidate_ref: candidate.id,
            candidate_hash: candidate.candidate_hash,
            review_status: status,
            user_statement: userStatement.trim(),
            rationale: rationale.trim(),
            checked_at: now.toISOString(),
        };
        const review = { ...base, entry_hash: candidateReviewEntryHash(base) };
        const updated = relationCandidateSchema.parse({ ...candidate, review_status: status, review_history: [...candidate.review_history, review] });
        await atomicReplaceIfUnchanged(filePath, before, stringifyYaml(updated));
        return updated;
    });
}
export async function writeGraphDocument(productRoot, graph) {
    const validated = graphDocumentSchema.parse(graph);
    await withGraphLock(productRoot, async () => {
        const filePath = edgePath(productRoot);
        try {
            const before = await readFile(filePath, 'utf8');
            await atomicReplaceIfUnchanged(filePath, before, stringifyYaml(validated));
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
            const created = await atomicCreateFile(filePath, stringifyYaml(validated));
            if (!created)
                throw new CliError('Graph was created concurrently; rerun validation.', ExitCode.USAGE_OR_IO);
        }
    });
}
export async function updateGraphDocument(productRoot, updater) {
    return withGraphLock(productRoot, async () => {
        const filePath = edgePath(productRoot);
        let before;
        let graph = { schema_version: 1, edges: [] };
        try {
            before = await readFile(filePath, 'utf8');
            graph = parseGraphDocument(before);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        const updated = graphDocumentSchema.parse(updater(graph));
        if (before === undefined) {
            if (!(await atomicCreateFile(filePath, stringifyYaml(updated))))
                throw new CliError('Graph was created concurrently; rerun.', ExitCode.USAGE_OR_IO);
        }
        else
            await atomicReplaceIfUnchanged(filePath, before, stringifyYaml(updated));
        return updated;
    });
}
//# sourceMappingURL=graph-store.js.map