import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256Hex } from '../src/clarification/hash.js';
import { applicationSchema, policySchema, productDefinitionSchema } from '../src/schema/definition.js';

const h=(s:string)=>sha256Hex(s);
const ref=(kind:'decision'|'prompt'|'node',id:string)=>({kind,ref:id,content_hash:h(id)});

describe('Change 07 Product Definition and Policy contracts',()=>{
  it('accepts a hash-bound Policy with explicit typed condition and provenance',()=>{
    const base={schema_version:1 as const,id:'POL-1111111111111111',context:'Checkout',actor:'customer',condition_text:'amount >= 10',condition:{op:'gte' as const,field:'amount',value_type:'number' as const,value:10,unit:'USD'},action:'allow purchase',outcome:'order accepted',exceptions:[],provenance:{origin:'user_decision' as const,source_refs:[ref('node','NOD-001-1')],decision_refs:[ref('decision','DEC-1111111111111111')],prompt_refs:[ref('prompt','PRM-001')]}};
    const value=policySchema.parse({...base,content_hash:sha256Hex(canonicalJson(base))});
    expect(value.condition).toMatchObject({op:'gte',value:10});
    expect(policySchema.safeParse({...value,condition:{op:'mystery'}}).success).toBe(false);
  });

  it('requires Decision and Prompt lineage for every normative Definition item',()=>{
    const base={schema_version:1 as const,id:'',status:'draft' as const,product_name:'Example',items:[{id:'ITM-aaaaaaaaaaaa',kind:'functional_requirement' as const,text:'Orders can be cancelled.',provenance:{origin:'user_decision' as const,source_refs:[ref('node','NOD-001-1')],decision_refs:[ref('decision','DEC-1111111111111111')],prompt_refs:[ref('prompt','PRM-001')]}}],journey_refs:[],policy_refs:[],finding_refs:[],assumption_refs:[],input_snapshot:[ref('decision','DEC-1111111111111111')],rules_version:'definition/1',created_at:'2026-10-13T00:00:00.000Z',history:[{event:'created' as const,at:'2026-10-13T00:00:00.000Z',content_hash:h('placeholder')}]};
    const content_hash=sha256Hex(canonicalJson({...base,id:undefined,content_hash:undefined,history:undefined,created_at:undefined}));
    const completed={...base,id:`DEF-${content_hash.slice(0,16)}`,content_hash,history:[{event:'created' as const,at:base.created_at,content_hash}]};
    expect(productDefinitionSchema.safeParse(completed).success).toBe(true);
    const noDecision={...completed,items:[{...completed.items[0]!,provenance:{...completed.items[0]!.provenance,decision_refs:[]}}]};
    expect(productDefinitionSchema.safeParse(noDecision).success).toBe(false);
  });

  it('rejects application marked applied until every target is verified',()=>{
    const content='policy: true\n'; const target={ref:ref('node','NOD-001-1'),path:'product/policies/POL-001.yaml',before_hash:null,after_hash:h(content),before_content:null,after_content:content};
    const plan={decision_ref:'DEC-1111111111111111',decision_hash:h('decision'),scope:'checkout',rationale:'explicit user choice',targets:[target],finding_refs:[],residual_risks:[],before_impact_refs:[]};
    const plan_hash=sha256Hex(canonicalJson(plan)); const timestamp='2026-10-13T00:00:00.000Z';
    const app={schema_version:1 as const,id:`APP-${plan_hash.slice(0,16)}`,plan,plan_hash,status:'applied' as const,verification_status:'pending' as const,impact_status:'unassessed' as const,impact_snapshots:[],target_states:[{path:target.path,state:'pending' as const,current_hash:null}],created_at:timestamp,updated_at:timestamp,history:[{event:'planned' as const,at:timestamp,statement:'Plan recorded.',plan_hash}]};
    expect(applicationSchema.safeParse(app).success).toBe(false);
  });
});
