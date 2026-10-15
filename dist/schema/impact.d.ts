import { z } from 'zod';
export declare const blockedInputSchema: z.ZodObject<{
    code: z.ZodString;
    ref: z.ZodOptional<z.ZodString>;
    candidate_ref: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const impactReportSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    analysis_id: z.ZodString;
    seed_node_ref: z.ZodString;
    rules_version: z.ZodString;
    input_fingerprint: z.ZodString;
    completeness: z.ZodEnum<{
        complete: "complete";
        incomplete: "incomplete";
    }>;
    confirmed_impacts: z.ZodArray<z.ZodObject<{
        node_ref: z.ZodString;
        certainty: z.ZodEnum<{
            confirmed: "confirmed";
            potential: "potential";
        }>;
        effect: z.ZodEnum<{
            dependency_candidate: "dependency_candidate";
            review_candidate: "review_candidate";
        }>;
        depth: z.ZodNumber;
        direct: z.ZodBoolean;
        path: z.ZodArray<z.ZodObject<{
            edge_ref: z.ZodString;
            type: z.ZodString;
            from: z.ZodString;
            to: z.ZodString;
            traversal: z.ZodEnum<{
                forward: "forward";
                reverse: "reverse";
            }>;
            basis: z.ZodString;
            reason: z.ZodString;
            effective_status: z.ZodEnum<{
                confirmed: "confirmed";
                proposed: "proposed";
                rejected: "rejected";
            }>;
            freshness: z.ZodEnum<{
                fresh: "fresh";
                stale: "stale";
            }>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    potential_impacts: z.ZodArray<z.ZodObject<{
        node_ref: z.ZodString;
        certainty: z.ZodEnum<{
            confirmed: "confirmed";
            potential: "potential";
        }>;
        effect: z.ZodEnum<{
            dependency_candidate: "dependency_candidate";
            review_candidate: "review_candidate";
        }>;
        depth: z.ZodNumber;
        direct: z.ZodBoolean;
        path: z.ZodArray<z.ZodObject<{
            edge_ref: z.ZodString;
            type: z.ZodString;
            from: z.ZodString;
            to: z.ZodString;
            traversal: z.ZodEnum<{
                forward: "forward";
                reverse: "reverse";
            }>;
            basis: z.ZodString;
            reason: z.ZodString;
            effective_status: z.ZodEnum<{
                confirmed: "confirmed";
                proposed: "proposed";
                rejected: "rejected";
            }>;
            freshness: z.ZodEnum<{
                fresh: "fresh";
                stale: "stale";
            }>;
        }, z.core.$strip>>;
        warnings: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    review_candidates: z.ZodObject<{
        confirmed: z.ZodArray<z.ZodObject<{
            node_ref: z.ZodString;
            certainty: z.ZodEnum<{
                confirmed: "confirmed";
                potential: "potential";
            }>;
            effect: z.ZodEnum<{
                dependency_candidate: "dependency_candidate";
                review_candidate: "review_candidate";
            }>;
            depth: z.ZodNumber;
            direct: z.ZodBoolean;
            path: z.ZodArray<z.ZodObject<{
                edge_ref: z.ZodString;
                type: z.ZodString;
                from: z.ZodString;
                to: z.ZodString;
                traversal: z.ZodEnum<{
                    forward: "forward";
                    reverse: "reverse";
                }>;
                basis: z.ZodString;
                reason: z.ZodString;
                effective_status: z.ZodEnum<{
                    confirmed: "confirmed";
                    proposed: "proposed";
                    rejected: "rejected";
                }>;
                freshness: z.ZodEnum<{
                    fresh: "fresh";
                    stale: "stale";
                }>;
            }, z.core.$strip>>;
            warnings: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        potential: z.ZodArray<z.ZodObject<{
            node_ref: z.ZodString;
            certainty: z.ZodEnum<{
                confirmed: "confirmed";
                potential: "potential";
            }>;
            effect: z.ZodEnum<{
                dependency_candidate: "dependency_candidate";
                review_candidate: "review_candidate";
            }>;
            depth: z.ZodNumber;
            direct: z.ZodBoolean;
            path: z.ZodArray<z.ZodObject<{
                edge_ref: z.ZodString;
                type: z.ZodString;
                from: z.ZodString;
                to: z.ZodString;
                traversal: z.ZodEnum<{
                    forward: "forward";
                    reverse: "reverse";
                }>;
                basis: z.ZodString;
                reason: z.ZodString;
                effective_status: z.ZodEnum<{
                    confirmed: "confirmed";
                    proposed: "proposed";
                    rejected: "rejected";
                }>;
                freshness: z.ZodEnum<{
                    fresh: "fresh";
                    stale: "stale";
                }>;
            }, z.core.$strip>>;
            warnings: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    blocked_inputs: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        candidate_ref: z.ZodOptional<z.ZodString>;
        reason: z.ZodString;
    }, z.core.$strip>>;
    warnings: z.ZodArray<z.ZodString>;
    created_at: z.ZodString;
}, z.core.$strict>;
export type ImpactReport = z.infer<typeof impactReportSchema>;
export declare function parseImpactReport(text: string): ImpactReport;
