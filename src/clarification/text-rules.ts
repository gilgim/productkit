// The one place that says what text a Policy or Journey may carry: a source
// Node's sentence or a cited Decision's words, verbatim. `productkit validate`
// and `productkit define draft` both call it, so a draft is refused with the
// same words validate would use.
import { contentTokens } from './spans.js';
import type { Journey, Policy } from '../schema/definition.js';

const sq = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.。]$/, '');

export function policyTextIssue(p: Policy, nodeSentences: string[], decisionStatements: string[]): string | undefined {
  const fields = [p.context, p.condition_text, p.action, p.outcome, ...p.exceptions.map(e => e.statement)].map(sq);
  const nodeTexts = nodeSentences.map(sq).filter(Boolean);
  const allowed = [...nodeTexts, ...decisionStatements.map(sq).filter(Boolean)];
  if (nodeTexts.length > 1) return `cites ${nodeTexts.length} Nodes; a Policy is one user sentence (one Node) plus cited Decisions, so its fields cannot be mixed between sentences.`;
  const missing = nodeTexts.filter(t => !fields.includes(t));
  if (missing.length) return `its source Node's sentence must appear as a whole field (context/condition_text/action/outcome/exception): "${missing[0]!.slice(0, 40)}"`;
  const invented = fields.filter(f => f && !allowed.includes(f));
  if (invented.length) return `every text field must be its source Node sentence or a cited Decision's user statement verbatim; these are not: ${invented.map(f => `"${f.slice(0, 40)}"`).join(', ')}`;
  const actor = sq(p.actor).toLowerCase();
  if (!allowed.some(t => [...contentTokens(t)].some(tok => tok === actor || tok.startsWith(actor)))) return `actor "${p.actor.slice(0, 30)}" is not a word of its source sentences.`;
  const astNums = JSON.stringify(p.condition).match(/-?\d+(?:\.\d+)?/g) ?? [];
  const textNums = new Set(p.condition_text.match(/\d+(?:\.\d+)?/g) ?? []);
  const stray = astNums.filter(n => !textNums.has(n.replace(/^-/, '')));
  if (stray.length) return `the structured condition uses numbers that are not in condition_text: ${stray.join(', ')}`;
  const units = (JSON.stringify(p.condition).match(/"unit":"([^"]+)"/g) ?? []).map(u => u.slice(8, -1));
  if (units.some(u => !p.condition_text.includes(u))) return `the structured condition's unit is not in condition_text.`;
  return undefined;
}

export function journeyTextIssue(j: Journey, nodeSentences: string[], decisionStatements: string[]): string | undefined {
  const fields = [j.goal, ...j.acceptance_criteria].map(sq);
  const nodeTexts = nodeSentences.map(sq).filter(Boolean);
  const allowed = [...nodeTexts, ...decisionStatements.map(sq).filter(Boolean)];
  const missing = nodeTexts.filter(t => !fields.includes(t));
  if (missing.length) return `each source Node's sentence must be a whole goal or acceptance criterion, not inside other text: "${missing[0]!.slice(0, 40)}"`;
  const invented = fields.filter(f => f && !allowed.includes(f));
  if (invented.length) return `goal and every acceptance criterion must be a source Node sentence or a cited Decision's user statement verbatim; these are not: ${invented.map(f => `"${f.slice(0, 40)}"`).join(', ')}`;
  const pieces = [j.actor, j.entry_state, ...j.states, ...j.terminal_states, ...j.transitions.flatMap(t => [t.from, t.to, t.trigger])].map(sq);
  const stray = pieces.filter(x => !allowed.some(t => t.includes(x)));
  if (stray.length) return `actor, states, triggers must be words taken from its source sentences; these are not: ${[...new Set(stray)].map(f => `"${f.slice(0, 30)}"`).join(', ')}`;
  return undefined;
}
