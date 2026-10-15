import { afterEach, describe, expect, it } from 'vitest';
import { allowFlagAttestation } from './helpers/gate-fixtures.js';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { promptFixture, confirmedFixture, groupFixture } from './helpers/gate-fixtures.js';
import { currentChallengeInputs } from '../src/clarification/challenge-store.js';
import { computeImpactReport } from '../src/clarification/graph.js';
import { loadGraphWorkspace } from '../src/clarification/provenance.js';
import { readGraphDocument, readRelationCandidates } from '../src/clarification/graph-store.js';
import { createFinding, appendFindingConfirmation, findingContentHash, toFindingInput } from '../src/schema/finding.js';
import { addDecision } from '../src/clarification/proposal-decision-store.js';
import { applyApplication, applicationFreshness, createApplication, recordApplicationVerification } from '../src/clarification/definition-store.js';
import { createPolicy } from '../src/schema/definition.js';
import { sha256Hex } from '../src/clarification/hash.js';

let temp='';
afterEach(async()=>{if(temp)await rm(temp,{recursive:true,force:true});});

async function setup(){
  temp=await mkdtemp(path.join(os.tmpdir(),'productkit-application-'));await runInit({cwd:temp,now:new Date('2026-10-13T00:00:00Z')},createMemoryOutput());await allowFlagAttestation(path.join(temp,'product'));const root=path.join(temp,'product');
  const prompt=promptFixture();const clarification=confirmedFixture(undefined,prompt);const group=groupFixture(clarification.steps);await writeFile(path.join(root,'sources',`${prompt.id}.yaml`),stringify(prompt));await writeFile(path.join(root,'discovery',`${clarification.id}.yaml`),stringify(clarification));await writeFile(path.join(root,'nodes',`${group.id}.yaml`),stringify(group));
  const finding=appendFindingConfirmation(createFinding({issue_key:'cancel-flow',type:'flow_gap',severity:'major',statement:'취소 가능 기간이 정의되지 않았다.',related_refs:[{kind:'node',ref:'NOD-001-1'}],evidence_refs:[{kind:'prompt',ref:prompt.id,detail:'취소 문장'}],counterexamples:[],ai_assessment:{is_ai_judgment:true,rationale:'기간 조건이 없다.',confidence:'medium',uncertainty:['정책 파일이 추가로 존재할 수 있다.']},questions:['취소 기간은 얼마인가?']}),'confirmed','SYNTHETIC TEST: 확인','SYNTHETIC TEST: 확인했습니다.');
  await writeFile(path.join(root,'findings',`${finding.id}.yaml`),stringify(finding));const current=await currentChallengeInputs(root);const find=(kind:string,id:string)=>current.inputs.find(x=>x.kind===kind&&x.ref===id)!.content_hash;
  const decision=await addDecision(root,{decision_type:'content_decision',finding_refs:[{finding_ref:finding.id,claim_hash:findingContentHash(toFindingInput(finding))}],selection:{kind:'direct_user_decision',text:'취소 가능 기간을 24시간으로 둔다.'},user_statement:'SYNTHETIC TEST ONLY: 24시간으로 정한다.',rationale:'주문 처리 전에 취소를 허용한다.',scope:'취소 정책',input_snapshot:[{kind:'prompt',ref:prompt.id,content_hash:find('prompt',prompt.id)},{kind:'node',ref:'NOD-001-1',content_hash:find('node','NOD-001-1')},{kind:'finding',ref:finding.id,content_hash:find('finding',finding.id)}]});
  const policy=createPolicy({schema_version:1,id:'POL-1111111111111111',context:'주문 취소',actor:'고객',condition_text:'주문 후 24시간 이내',condition:{op:'lte',field:'hours_since_order',value_type:'number',value:24,unit:'hour'},action:'취소 요청 허용',outcome:'주문 취소 접수',exceptions:[],priority:{value:1,decision_ref:decision.decision.id},provenance:{origin:'user_decision',source_refs:[{kind:'node',ref:'NOD-001-1',content_hash:find('node','NOD-001-1')}],decision_refs:[{kind:'decision',ref:decision.decision.id,content_hash:decision.decision.decision_hash}],prompt_refs:[{kind:'prompt',ref:prompt.id,content_hash:find('prompt',prompt.id)}]}});
  const content=stringify(policy);const target={ref:{kind:'policy' as const,ref:policy.id,content_hash:policy.content_hash},path:`product/policies/${policy.id}.yaml`,before_hash:null,after_hash:sha256Hex(content),before_content:null,after_content:content};
  const workspace=await loadGraphWorkspace(root);const {graph}=await readGraphDocument(root);const candidates=await readRelationCandidates(root);const impact=computeImpactReport({seedNodeId:'NOD-001-1',graphEdges:graph.edges,candidates,workspace,createdAt:'2026-10-13T00:00:00.000Z'});const reportsDir=path.join(root,'graph','reports');await mkdir(reportsDir,{recursive:true});await writeFile(path.join(reportsDir,`${impact.analysis_id}.yaml`),stringify(impact));
  const plan={decision_ref:decision.decision.id,decision_hash:decision.decision.decision_hash,scope:'취소 정책',rationale:'사용자 Decision 반영',targets:[target],finding_refs:[finding.id],residual_risks:['기간 이후 취소는 별도 검토'],before_impact_refs:[impact.analysis_id]};return{root,plan,decision:decision.decision,finding};
}

describe('Decision Application persistence',()=>{
  it('checks every preview hash before writes, then marks applied only after target verification',async()=>{
    const {root,plan,decision,finding}=await setup();const altered={...plan,targets:[{...plan.targets[0]!,before_content:'newer user content',before_hash:sha256Hex('newer user content')}]};
    await expect(createApplication(root,altered)).rejects.toThrow(/changed since preview/);
    const result=await createApplication(root,plan);expect(result.application.status).toBe('pending');
    const replay=await createApplication(root,plan);expect(replay.created).toBe(false);expect(replay.application.id).toBe(result.application.id);
    const applied=await applyApplication(root,result.application.id);expect(applied.status).toBe('applied');expect(applied.verification_status).toBe('pending');expect(applied.impact_snapshots.filter(s=>s.phase==='after')).toHaveLength(1);
    expect((await readFile(path.join(root,'decisions',`${decision.id}.yaml`),'utf8'))).toContain('pending_application');
    expect((await readFile(path.join(root,'findings',`${finding.id}.yaml`),'utf8'))).toContain('unresolved');
    const target=plan.targets[0]!;expect(sha256Hex(await readFile(path.join(root,'policies',`${target.ref.ref}.yaml`),'utf8'))).toBe(target.after_hash);
    const verified=await recordApplicationVerification(root,applied.id,{status:'inconclusive',assessor:'ai',summary:'Synthetic assessment: semantic closure remains uncertain.',evidence_refs:[{kind:'decision',ref:decision.id,content_hash:decision.decision_hash}],uncertainty:['Synthetic test data; no real user response.']});expect(verified.verification_status).toBe('inconclusive');expect((await applicationFreshness(root,verified)).stale).toBe(false);
  });

  it('does not expose an application as complete when target access fails before publication',async()=>{
    const {root,plan}=await setup();const result=await createApplication(root,plan);
    const target=plan.targets[0]!;const file=path.join(root,'..',target.path);await mkdir(file,{recursive:true});
    await expect(applyApplication(root,result.application.id)).rejects.toThrow();
    const stored=parseYaml(await readFile(path.join(root,'applications',`${result.application.id}.yaml`),'utf8')) as {status:string};
    expect(stored.status).not.toBe('applied');
    expect(await readFile(file).catch(()=>undefined)).toBeUndefined();
  });

  it('rejects changed target bytes on apply and preserves the user file',async()=>{
    const {root,plan}=await setup();const file=path.join(root,'policies','POL-1111111111111111.yaml');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'user edit\n');
    await expect(createApplication(root,plan)).rejects.toThrow(/changed since preview/);expect(await readFile(file,'utf8')).toBe('user edit\n');
  });

  it('resumes a partially published multi-file application idempotently and supports guarded rollback',async()=>{
    const {root,plan}=await setup();const first=plan.targets[0]!;const firstFile=path.join(root,'policies',`${first.ref.ref}.yaml`);
    const secondContent=first.after_content.replace('POL-1111111111111111','POL-2222222222222222');
    const secondValue=parseYaml(secondContent) as Record<string,unknown>;secondValue.id='POL-2222222222222222';
    const secondPolicy=createPolicy({...secondValue,content_hash:undefined} as never);const serialized=stringify(secondPolicy);const secondTarget={...first,ref:{kind:'policy' as const,ref:secondPolicy.id,content_hash:secondPolicy.content_hash},path:`product/policies/${secondPolicy.id}.yaml`,after_hash:sha256Hex(serialized),after_content:serialized};
    const application=await createApplication(root,{...plan,targets:[first,secondTarget]});await mkdir(path.dirname(firstFile),{recursive:true});await writeFile(firstFile,first.after_content);
    const resumed=await applyApplication(root,application.application.id);expect(resumed.status).toBe('applied');expect(resumed.target_states.every(x=>x.state==='verified')).toBe(true);
    expect((await applyApplication(root,application.application.id)).history).toHaveLength(resumed.history.length);
    const rolled=await (await import('../src/clarification/definition-store.js')).rollbackApplication(root,application.application.id);expect(rolled.status).toBe('rolled_back');
    await expect(readFile(firstFile,'utf8')).rejects.toMatchObject({code:'ENOENT'});
    await expect(readFile(path.join(root,'policies',`${secondPolicy.id}.yaml`),'utf8')).rejects.toMatchObject({code:'ENOENT'});
  });
});
