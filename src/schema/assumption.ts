import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
import { proposalRefSchema } from './proposal.js';

const hash=z.string().regex(/^[0-9a-f]{64}$/);const id=/^ASM-[0-9a-f]{16}$/;const decisionId=/^DEC-[0-9a-f]{16}$/;
export const assumptionInputSchema=z.object({finding_ref:z.string().regex(/^FND-[0-9a-f]{16}$/),finding_hash:hash,statement:z.string().trim().min(1),risk:z.enum(['critical','noncritical']),evidence_refs:z.array(proposalRefSchema)}).strict();
export type AssumptionInput=z.infer<typeof assumptionInputSchema>;
const status=z.enum(['unverified','verified','disproven','accepted_risk']);
const event=z.object({at:z.string().datetime({offset:true}),prior_status:status.optional(),status,decision_ref:z.string().regex(decisionId).optional(),rationale:z.string().trim().min(1),record_hash:hash}).strict();
export const assumptionSchema=assumptionInputSchema.extend({schema_version:z.literal(1),id:z.string().regex(id),fingerprint:hash,status,decision_ref:z.string().regex(decisionId).optional(),rationale:z.string().trim().min(1).optional(),created_at:z.string().datetime({offset:true}),history:z.array(event).min(1)}).strict().superRefine((a,ctx)=>{
 const fingerprint=sha256Hex(canonicalJson({finding_ref:a.finding_ref,finding_hash:a.finding_hash,statement:a.statement,risk:a.risk,evidence_refs:a.evidence_refs}));if(a.fingerprint!==fingerprint||a.id!==`ASM-${fingerprint.slice(0,16)}`)ctx.addIssue({code:'custom',path:['fingerprint'],message:'Assumption identity/hash mismatch.'});
 if(a.status!=='unverified'&&!a.decision_ref)ctx.addIssue({code:'custom',path:['decision_ref'],message:'Assumption status changes require an explicit Decision.'});
 if(a.status==='accepted_risk'&&!a.rationale)ctx.addIssue({code:'custom',path:['rationale'],message:'Risk acceptance requires a rationale.'});
 const latest=a.history.at(-1);if(!latest||latest.status!==a.status||latest.decision_ref!==a.decision_ref)ctx.addIssue({code:'custom',path:['history'],message:'Assumption history must match the current status.'});
 a.history.forEach((entry,index)=>{const{record_hash,...body}=entry;if(eventHash(body)!==record_hash)ctx.addIssue({code:'custom',path:['history',index],message:'Assumption history hash mismatch.'});if(index>0&&(entry.prior_status!==a.history[index-1]!.status||!entry.decision_ref))ctx.addIssue({code:'custom',path:['history',index],message:'Assumption transitions require a Decision and must continue prior state.'});});
});
export type Assumption=z.infer<typeof assumptionSchema>;
function eventHash(value:Omit<z.infer<typeof event>,'record_hash'>):string{return sha256Hex(canonicalJson(value));}
export function createAssumption(value:unknown,now=new Date()):Assumption{const input=assumptionInputSchema.parse(value);const fingerprint=sha256Hex(canonicalJson(input));const at=now.toISOString();const first={at,status:'unverified' as const,rationale:'Assumption recorded; not verified or accepted.'};return assumptionSchema.parse({...input,schema_version:1,id:`ASM-${fingerprint.slice(0,16)}`,fingerprint,status:'unverified',created_at:at,history:[{...first,record_hash:eventHash(first)}]});}
export function transitionAssumption(value:unknown,next:'verified'|'disproven'|'accepted_risk',decisionRef:string,rationale:string,now=new Date()):Assumption{const current=assumptionSchema.parse(value);const why=z.string().trim().min(1).parse(rationale);const ref=z.string().regex(decisionId).parse(decisionRef);const at=now.toISOString();const body={at,prior_status:current.status,status:next,decision_ref:ref,rationale:why};return assumptionSchema.parse({...current,status:next,decision_ref:ref,rationale:why,history:[...current.history,{...body,record_hash:eventHash(body)}]});}
