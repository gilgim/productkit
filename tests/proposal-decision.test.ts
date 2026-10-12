import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { createProposal, proposalInputSchema, parseProposal } from '../src/schema/proposal.js';
import { createDecision, decisionInputSchema, parseDecision } from '../src/schema/decision.js';

const findingA = { finding_ref: 'FND-aaaaaaaaaaaaaaaa', claim_hash: 'a'.repeat(64), review_status: 'confirmed' as const };
const findingB = { finding_ref: 'FND-bbbbbbbbbbbbbbbb', claim_hash: 'b'.repeat(64), review_status: 'confirmed' as const };
const option = (id: string, findingRefs: string[]) => ({
  id, description: `Alternative ${id}`, evidence_refs: [{ kind: 'node' as const, ref: 'NOD-001-1', content_hash: 'c'.repeat(64) }],
  benefits: ['Clear behavior'], costs: ['Implementation effort'], risks: ['Possible edge gap'], assumptions: ['Provider supports retry'],
  expected_impacts: ['Changes retry flow'], side_effects: ['May increase latency'],
  target_candidates: [{ kind: 'node' as const, ref: 'NOD-001-1', content_hash: 'c'.repeat(64) }],
  finding_coverage: findingRefs.map((finding_ref) => ({ finding_ref, approach: `Address ${finding_ref}`, residual_issues: ['Review provider limits'] })),
});
const proposalInput = {
  finding_refs: [findingA, findingB],
  input_snapshot: [{ kind: 'node' as const, ref: 'NOD-001-1', content_hash: 'c'.repeat(64) }],
  options: [option('OPT-A', [findingA.finding_ref, findingB.finding_ref]), option('OPT-B', [findingA.finding_ref, findingB.finding_ref])],
  ai_recommendation: { is_ai_recommendation: true as const, option_ref: 'OPT-A', rationale: 'Lower operational risk', confidence: 'medium' as const, uncertainty: ['Provider limits need confirmation.'] },
  supersedes_proposal_ref: undefined,
};
const decisionInput = {
  decision_type:'content_decision' as const, proposal_ref:'PROP-0000000000000000', option_ref:'OPT-A',
  finding_refs:[{finding_ref:findingA.finding_ref,claim_hash:findingA.claim_hash}], selection:{kind:'proposal_option' as const,proposal_ref:'PROP-0000000000000000',option_ref:'OPT-A'},
  user_statement:'I choose option A.', rationale:'It reduces operational risk.', scope:'Retry behavior only.',
  input_snapshot:[{kind:'node' as const,ref:'NOD-001-1',content_hash:'c'.repeat(64)},{kind:'proposal' as const,ref:'PROP-0000000000000000',content_hash:'d'.repeat(64)}],
};

describe('Proposal and Decision contracts', () => {
  it('creates an unselected Proposal for multiple confirmed Findings and preserves alternatives', () => {
    const proposal = createProposal(proposalInput, new Date('2026-10-13T00:00:00.000Z'));
    expect(proposal.id).toMatch(/^PROP-[0-9a-f]{16}$/);
    expect(proposal.status).toBe('pending');
    expect(proposal.finding_refs).toHaveLength(2);
    expect(proposal.options).toHaveLength(2);
    expect(proposal.ai_recommendation?.option_ref).toBe('OPT-A');
    expect(proposal.selected_option_ref).toBeUndefined();
    expect(parseProposal(JSON.stringify(proposal))).toEqual(proposal);
  });

  it('keeps the documented Proposal input example valid against the executable schema', () => {
    const docs=readFileSync(new URL('../docs/artifact-contracts.md',import.meta.url),'utf8');
    const section=docs.split('## Proposal (Change 06)')[1]?.split('## Decision (Change 06)')[0]??'';
    const yaml=section.match(/```yaml\n([\s\S]*?)```/)?.[1];
    expect(yaml).toBeDefined();
    expect(proposalInputSchema.parse(parseYaml(yaml!)).options).toHaveLength(2);
  });

  it('keeps selected-option and direct-user Decision examples valid against the executable schema', () => {
    const docs=readFileSync(new URL('../docs/artifact-contracts.md',import.meta.url),'utf8');
    const section=docs.split('## Decision (Change 06)')[1]?.split('## Assumption (Change 06~07)')[0]??'';
    const examples=[...section.matchAll(/```yaml\n([\s\S]*?)```/g)].map(match=>parseYaml(match[1]!));
    expect(examples).toHaveLength(2);
    expect(examples.map(item=>decisionInputSchema.parse(item).selection.kind)).toEqual(['proposal_option','direct_user_decision']);
  });

  it('rejects incomplete per-Finding coverage and attempts to submit a chosen option as AI state', () => {
    expect(proposalInputSchema.safeParse({ ...proposalInput, options: [option('OPT-A', [findingA.finding_ref])] }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...proposalInput, selected_option_ref: 'OPT-A' }).success).toBe(false);
    const first=createProposal(proposalInput);
    const revised=createProposal({...proposalInput,supersedes_proposal_ref:first.id,options:[option('OPT-A',[findingA.finding_ref,findingB.finding_ref]),option('OPT-B',[findingA.finding_ref,findingB.finding_ref])].map((o,i)=>i===1?{...o,description:'A revised alternative'}:o)});
    expect(revised.id).not.toBe(first.id);
    expect(revised.supersedes_proposal_ref).toBe(first.id);
  });

  it('records a user choice as pending application with a verifiable immutable hash', () => {
    const decision=createDecision(decisionInput,new Date('2026-10-13T00:00:00.000Z'));
    expect(decision.id).toMatch(/^DEC-[0-9a-f]{16}$/);
    expect(decision.application_status).toBe('pending_application');
    expect(parseDecision(JSON.stringify(decision))).toEqual(decision);
    expect(decisionInputSchema.safeParse({...decisionInput,user_statement:'   '}).success).toBe(false);
    const direct=createDecision({...decisionInput,proposal_ref:undefined,option_ref:undefined,input_snapshot:decisionInput.input_snapshot.filter(ref=>ref.kind!=='proposal'),selection:{kind:'direct_user_decision',text:'  Keep the current behavior, but add a timeout warning.  '}});
    expect(direct.selection).toEqual({kind:'direct_user_decision',text:'  Keep the current behavior, but add a timeout warning.  '});
  });

  it('requires explicit residual risk for Critical scope exclusion and prevents malformed proposal selection', () => {
    expect(decisionInputSchema.safeParse({...decisionInput,decision_type:'scope_exclusion',scope_exclusion:{excluded_scope:'Payments',impact:'Fraud exposure',residual_risk:''}}).success).toBe(false);
    expect(decisionInputSchema.safeParse({...decisionInput,selection:{kind:'proposal_option',proposal_ref:'PROP-ffffffffffffffff',option_ref:'missing'}}).success).toBe(false);
    const exclusion={...decisionInput,decision_type:'scope_exclusion' as const,proposal_ref:undefined,option_ref:undefined,selection:{kind:'direct_user_decision' as const,text:'Exclude enterprise SSO from this release.'},input_snapshot:decisionInput.input_snapshot.filter(ref=>ref.kind!=='proposal'),scope_exclusion:{excluded_scope:'Enterprise SSO',impact:'Enterprise accounts cannot authenticate through SSO.',residual_risk:'Some target organizations remain unsupported.'}};
    expect(createDecision(exclusion).application_status).toBe('pending_application');
    expect(decisionInputSchema.safeParse({...exclusion, user_statement:undefined}).success).toBe(false);
  });
});
