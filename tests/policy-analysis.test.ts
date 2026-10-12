import { describe, expect, it } from 'vitest';
import { createPolicy } from '../src/schema/definition.js';
import { classifyPolicyPair } from '../src/clarification/policy-analysis.js';

function policy(id:string,condition:unknown){return createPolicy({schema_version:1,id:`POL-${id.padStart(16,'0')}`,context:'checkout',actor:'customer',condition_text:'test condition',condition,action:'allow',outcome:'approved',exceptions:[],provenance:{origin:'user_decision',source_refs:[{kind:'node',ref:'NOD-001-1',content_hash:'a'.repeat(64)}],decision_refs:[{kind:'decision',ref:'DEC-1111111111111111',content_hash:'b'.repeat(64)}],prompt_refs:[{kind:'prompt',ref:'PRM-001',content_hash:'c'.repeat(64)}]}});}

describe('bounded policy condition analysis',()=>{
  it('keeps possible condition overlap as a semantic candidate rather than a conflict verdict',()=>{
    const a=policy('1',{op:'gte',field:'amount',value_type:'number',value:10,unit:'USD'});const b=policy('2',{op:'lte',field:'amount',value_type:'number',value:20,unit:'USD'});
    expect(classifyPolicyPair(a,b)).toMatchObject({classification:'semantic_candidate',overlap:'possible'});
  });
  it('reports supported disjoint ranges as independent conditions',()=>{
    const a=policy('1',{op:'lt',field:'age',value_type:'number',value:18});const b=policy('2',{op:'gte',field:'age',value_type:'number',value:18});
    expect(classifyPolicyPair(a,b)).toMatchObject({classification:'independent_conditions',overlap:'disjoint'});
  });
  it('leaves NOT and unsupported condition operators inconclusive',()=>{
    const a=policy('1',{op:'not',arg:{op:'eq',field:'role',value_type:'string',value:'admin'}});const b=policy('2',{op:'eq',field:'role',value_type:'string',value:'user'});
    expect(classifyPolicyPair(a,b).classification).toBe('inconclusive');
  });
});
