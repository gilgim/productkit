import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {stringify} from '../../../../node_modules/yaml/dist/index.js';
import * as pk from '../../../../dist/index.js';
const base='/tmp/productkit-change04-audit';
const bin=path.resolve('dist/cli/bin.js');
const cli=(cwd,args)=>{const r=spawnSync(process.execPath,[bin,...args],{cwd,encoding:'utf8'});return {args,exit:r.status,stdout:r.stdout,stderr:r.stderr};};
const texts=[
'결제가 완료되면 주문을 확정하고 이메일을 보내고 재고를 차감한다.',
'로그인 실패가 3회 이상이고 최근 1시간 이내이거나 관리자가 잠금을 요청하면 계정을 잠근다. 단, 서비스 계정은 제외한다.',
'기존 규정: 구매 후 7일 이내 환불 가능. 신규 요구: 디지털 상품은 구매 후 30일 이내 환불 가능.'
];
let cases=[];
for(let i=0;i<texts.length;i++){
 const cwd=base+'/case-'+(i+1);await fs.mkdir(cwd,{recursive:true});
 const init=cli(cwd,['init']); const intake=cli(cwd,['intake',texts[i]]);
 const prompt=pk.parsePrompt(await fs.readFile(cwd+'/product/sources/PRM-001.yaml','utf8'));
 // This is a primary-agent draft, not Claude Code output and not user-approved.
 const clarification={id:'CLR-001',prompt_ref:'PRM-001',steps:{definition:[],decomposition:[{statement:texts[i],span_refs:prompt.spans.map(s=>s.id)}],elaboration:[],relation_check:[],counterexample:[]},status:'awaiting_confirmation',interpretation_check:[],finding_candidates:[]};
 await fs.writeFile(cwd+'/product/discovery/CLR-001.yaml',stringify(clarification));
 cases.push({case:i+1,kind:'primary-agent minimal structural draft; NOT Claude E2E',original:texts[i],clarification,init,intake,clarify:cli(cwd,['clarify']),model:cli(cwd,['model']),node_result:'not generated: no actual user confirmation'});
}
// Explicitly synthetic confirmation; never used as user E2E or production data.
const steps={definition:[],decomposition:[],elaboration:[],relation_check:[],counterexample:[]};
const entry={id:'SYNTHETIC-IC',presented_statement:'SYNTHETIC empty steps',presented_hash:pk.stepsContentHash(steps),user_response:'agreed',user_statement:'SYNTHETIC TEST ONLY',checked_at:'2026-10-12T00:00:00Z'};
const c=pk.clarificationSchema.parse({id:'CLR-001',prompt_ref:'PRM-999',steps,status:'confirmed',interpretation_check:[{...entry,entry_hash:pk.computeEntryHash(entry)}]});
const cwd=base+'/case-1';await fs.writeFile(cwd+'/product/discovery/CLR-001.yaml',stringify(c));
const probes={synthetic:true,empty_steps:pk.judgeCompletion(c),missing_prompt_ref:cli(cwd,['clarify']),empty_nodes:pk.judgeNodeSetCompletion(pk.nodeGroupSchema.parse({id:'NDG-001',clarification_ref:'CLR-001',source_content_hash:pk.stepsContentHash(steps),nodes:[],coverage:{complete:true,uncovered_decomposition_indices:[]},status:'modeled'}),steps)};
const a={single_verifiable_subject:{verdict:'no',reason:'synthetic independent actions'},decomposability:{verdict:'valid_split',reason:'synthetic'},meaning_preservation:{verdict:'preserved',confidence:'high',reason:'synthetic'}};
const s={...steps,decomposition:[{statement:'independent actions',span_refs:[]}]};
const n={id:'NOD-001-1',kind:'requirement',statement:'independent actions',origin:'source',derived_from:{clarification_ref:'CLR-001',decomposition_index:0},structural_signal:{conjunction_count:1,multiple_predicates:true},atomicity:{...a,final:pk.evaluateAtomicityFinal(a)}};
probes.split_required_group=pk.judgeNodeSetCompletion(pk.nodeGroupSchema.parse({id:'NDG-001',clarification_ref:'CLR-001',source_content_hash:pk.stepsContentHash(s),nodes:[n],coverage:{complete:true,uncovered_decomposition_indices:[]},status:'modeled'}),s);
await fs.writeFile(base+'/cases.json',JSON.stringify(cases,null,2));await fs.writeFile(base+'/probes.json',JSON.stringify(probes,null,2));
console.log(JSON.stringify({cases:cases.map(c=>({case:c.case,clarify:c.clarify,model:c.model})),probes},null,2));
