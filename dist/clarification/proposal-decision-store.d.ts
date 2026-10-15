import { type Proposal, type ProposalInput } from '../schema/proposal.js';
import { type Decision, type DecisionInput } from '../schema/decision.js';
import { type Finding } from '../schema/finding.js';
import { type Assumption, type AssumptionInput } from '../schema/assumption.js';
export declare function readProposals(root: string): Promise<Proposal[]>;
export declare function readDecisions(root: string): Promise<Decision[]>;
export declare function readAssumptions(root: string): Promise<Assumption[]>;
export declare function readCurrentFindings(root: string): Promise<Finding[]>;
export declare function addProposal(root: string, input: ProposalInput): Promise<{
    proposal: Proposal;
    created: boolean;
}>;
export declare function addDecision(root: string, input: DecisionInput): Promise<{
    decision: Decision;
    created: boolean;
}>;
export declare function decisionStaleness(root: string): Promise<Array<{
    decision: Decision;
    reasons: string[];
}>>;
export declare function addAssumption(root: string, input: AssumptionInput): Promise<{
    assumption: Assumption;
    created: boolean;
}>;
export declare function updateAssumptionStatus(root: string, id: string, next: 'verified' | 'disproven' | 'accepted_risk', decisionRef: string, rationale: string): Promise<Assumption>;
