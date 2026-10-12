import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stringify } from '../../../../node_modules/yaml/dist/index.js';
const versions={before:'/tmp/productkit-critical-gates/before-dist',after:path.resolve('dist')};
const results=[];
for(const [version,dist] of Object.entries(versions)) {
 const api=await import(pathToFileURL(path.join(dist,'index.js')));
 const corrected=typeof api.clarificationContentHash==='function';
 for(const scenario of ['empty','valid','split_required','missing_prompt','changed_prompt','changed_clarification']) {
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pk-gate-diff-'));
  const cli=(...args)=>{const r=spawnSync(process.execPath,[path.join(dist,'cli/bin.js'),...args],{cwd,encoding:'utf8'});return {args,exit:r.status,stdout:r.stdout,stderr:r.stderr};};
  const original='결제가 완료되면 주문을 확정하고 이메일을 보낸다.';
  cli('init');cli('intake',original);
  const source=api.parsePrompt(await fs.readFile(path.join(cwd,'product/sources/PRM-001.yaml'),'utf8'));
  const steps={definition:[{term:'주문 확정',meaning:'결제 완료 후 주문을 확정하는 행동',origin:'ai_inferred'}],decomposition:[{statement:original,span_refs:['SPN-001']}],elaboration:[{statement:original,actor:'시스템',object:'주문과 이메일',condition:'결제 완료',action:'주문 확정과 이메일 전송',result:'주문 확정 및 이메일 발송'}],relation_check:[],relation_check_no_items_reason:'다른 진술과 필수 의존 관계는 발견하지 못했다.',counterexample:[],counterexample_no_items_reason:'조건을 대조했으며 추가 해석 후보를 발견하지 못했다.'};
  if(scenario==='empty') for(const key of ['definition','decomposition','elaboration','relation_check','counterexample']) steps[key]=[];
  const c=api.clarificationSchema.parse({id:'CLR-001',prompt_ref:'PRM-001',prompt_content_hash:source.content_hash,steps,status:'confirmed',interpretation_check:[],finding_candidates:[]});
  const e={id:'SYNTHETIC-IC',presented_statement:'SYNTHETIC: '+original,presented_hash:api.stepsContentHash(c.steps),user_response:'agreed',user_statement:'SYNTHETIC TEST ONLY',checked_at:'2026-10-13T00:00:00Z',...(corrected?{prompt_ref:source.id,prompt_content_hash:source.content_hash}:{})};
  c.interpretation_check=[{...e,entry_hash:api.computeEntryHash(e)}];
  const atomicity={single_verifiable_subject:{verdict:'yes',reason:'단일 결과로 판정한 합성 fixture'},decomposability:{verdict:'not_applicable',reason:'분해 대상 없음으로 판정한 합성 fixture'},meaning_preservation:{verdict:'preserved',confidence:'high',reason:'원문과 대조한 합성 검토'},final:'atomic'};
  if(scenario==='split_required'){atomicity.single_verifiable_subject.verdict='no';atomicity.decomposability.verdict='valid_split';atomicity.final=api.evaluateAtomicityFinal(atomicity);}
  const review={verdict:'preserved',reason:'합성 검토 기록'};
  const group=api.nodeGroupSchema.parse({id:'NDG-001',clarification_ref:c.id,source_content_hash:api.stepsContentHash(c.steps),...(corrected?{clarification_content_hash:api.clarificationContentHash(c)}:{}),nodes:[{id:'NOD-001-1',kind:'requirement',statement:original,origin:'source',derived_from:{clarification_ref:c.id,decomposition_index:0},structural_signal:{conjunction_count:1,multiple_predicates:false},atomicity}],coverage:{complete:true,uncovered_decomposition_indices:[]},distortion_checks:[{decomposition_index:0,reconstructed_statement:original,verdict:'preserved',confidence:'high',reason:'합성 역합성 검토',condition_preservation:review,operator_preservation:review,exception_preservation:review}],finding_candidates:[],status:'modeled'});
  if(scenario==='missing_prompt') c.prompt_ref='PRM-999';
  if(scenario==='changed_prompt') await fs.writeFile(path.join(cwd,'product/sources/PRM-001.yaml'),stringify({...source,raw_text:'결제 없이 주문을 확정한다.'}));
  if(scenario==='changed_clarification') c.steps.definition[0].meaning='변경된 용어 정의';
  const clrPath=path.join(cwd,'product/discovery/CLR-001.yaml');const grpPath=path.join(cwd,'product/nodes/NDG-001.yaml');
  await fs.writeFile(clrPath,stringify(c));await fs.writeFile(grpPath,stringify(group));
  results.push({version,scenario,synthetic:true,original,clarification:c,node_group:group,clarify:cli('clarify','--prompt','PRM-001'),model:cli('model','--clarification','CLR-001'),artifacts_preserved: (await fs.readFile(clrPath,'utf8'))===stringify(c)&&(await fs.readFile(grpPath,'utf8'))===stringify(group)});
 }
}
await fs.writeFile('/tmp/productkit-critical-gates/cli-before-after.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(r=>({version:r.version,scenario:r.scenario,clarify:r.clarify.stdout.split('\n')[0]||r.clarify.stderr.split('\n')[0],model:r.model.stdout.split('\n')[0]||r.model.stderr.split('\n')[0],preserved:r.artifacts_preserved})),null,2));
