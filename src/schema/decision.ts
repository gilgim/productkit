import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
import { proposalRefSchema } from './proposal.js';

const hash=z.string().regex(/^[0-9a-f]{64}$/);
export const decisionInputSchema=z.object({
  decision_type:z.enum(['content_decision','scope_exclusion']),
  proposal_ref:z.string().regex(/^PROP-[0-9a-f]{16}$/).optional(), option_ref:z.string().optional(),
  finding_refs:z.array(z.object({finding_ref:z.string().regex(/^FND-[0-9a-f]{16}$/),claim_hash:hash}).strict()).min(1),
  selection:z.discriminatedUnion('kind',[
    z.object({kind:z.literal('proposal_option'),proposal_ref:z.string().regex(/^PROP-[0-9a-f]{16}$/),option_ref:z.string().min(1)}).strict(),
    z.object({kind:z.literal('direct_user_decision'),text:z.string().refine(s=>s.trim().length>0,'Decision text must not be blank.').min(1)}).strict(),
  ]),
  user_statement:z.string().refine(s=>s.trim().length>0,'User statement must not be blank.').min(1), rationale:z.string().trim().min(1), scope:z.string().trim().min(1),
  input_snapshot:z.array(proposalRefSchema).min(1),
  scope_exclusion:z.object({excluded_scope:z.string().trim().min(1),impact:z.string().trim().min(1),residual_risk:z.string().trim().min(1)}).strict().optional(),
  supersedes_decision_ref:z.string().regex(/^DEC-[0-9a-f]{16}$/).optional(),
}).strict().superRefine((v,ctx)=>{
  const selectedProposal=v.selection.kind==='proposal_option'?v.selection.proposal_ref:undefined;
  if(v.decision_type==='scope_exclusion'&&!v.scope_exclusion) ctx.addIssue({code:'custom',path:['scope_exclusion'],message:'Scope exclusion requires explicit excluded scope, impact, and residual risk.'});
  if(v.decision_type==='content_decision'&&v.scope_exclusion) ctx.addIssue({code:'custom',path:['scope_exclusion'],message:'Scope exclusion details are only valid for scope_exclusion decisions.'});
  if(v.selection.kind==='proposal_option'&&(v.proposal_ref!==v.selection.proposal_ref||v.option_ref!==v.selection.option_ref)) ctx.addIssue({code:'custom',path:['selection'],message:'Selected proposal and option must match decision references.'});
  if(v.selection.kind==='direct_user_decision'&&(v.proposal_ref||v.option_ref)) ctx.addIssue({code:'custom',path:['selection'],message:'Direct user decisions cannot claim a Proposal option.'});
  if(selectedProposal&&!v.input_snapshot.some(r=>r.kind==='proposal'&&r.ref===selectedProposal)) ctx.addIssue({code:'custom',path:['input_snapshot'],message:'A Proposal option Decision must bind the current Proposal hash.'});
});
export type DecisionInput=z.infer<typeof decisionInputSchema>;
export const decisionSchema=decisionInputSchema.extend({schema_version:z.literal(1),id:z.string().regex(/^DEC-[0-9a-f]{16}$/),decision_hash:hash,application_status:z.literal('pending_application'),created_at:z.string().datetime({offset:true}),history:z.array(z.object({event:z.literal('recorded'),at:z.string().datetime({offset:true}),decision_hash:hash}).strict()).min(1)}).strict().superRefine((d,ctx)=>{
  const input={decision_type:d.decision_type,...(d.proposal_ref?{proposal_ref:d.proposal_ref}:{}),...(d.option_ref?{option_ref:d.option_ref}:{}),finding_refs:d.finding_refs,selection:d.selection,user_statement:d.user_statement,rationale:d.rationale,scope:d.scope,input_snapshot:d.input_snapshot,...(d.scope_exclusion?{scope_exclusion:d.scope_exclusion}:{}),...(d.supersedes_decision_ref?{supersedes_decision_ref:d.supersedes_decision_ref}:{})};
  const h=sha256Hex(canonicalJson(input)); if(d.decision_hash!==h||d.id!==`DEC-${h.slice(0,16)}`) ctx.addIssue({code:'custom',path:['decision_hash'],message:'Decision ID/hash mismatch.'});
  if(d.history[0]?.decision_hash!==h)ctx.addIssue({code:'custom',path:['history'],message:'Decision creation history must bind the immutable Decision hash.'});
});
export type Decision=z.infer<typeof decisionSchema>;
export function createDecision(value:unknown,now=new Date()):Decision { const input=decisionInputSchema.parse(value); const decision_hash=sha256Hex(canonicalJson(input)); const at=now.toISOString(); return decisionSchema.parse({...input,schema_version:1,id:`DEC-${decision_hash.slice(0,16)}`,decision_hash,application_status:'pending_application',created_at:at,history:[{event:'recorded',at,decision_hash}]}); }
export function parseDecision(text:string):Decision { return decisionSchema.parse(parseYaml(text)); }
