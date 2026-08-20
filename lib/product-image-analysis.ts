import { z } from "zod";

export const modelImageAnalysisSchema = z
  .object({
    isProductRelevant: z.boolean(),
    relevanceReason: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(600),
    visibleDetails: z.array(z.string().trim().min(1).max(300)).max(12),
    candidateFacts: z
      .array(
        z
          .object({
            factKey: z.string().trim().min(1).max(120),
            value: z.string().trim().min(1).max(1000),
            confidence: z.number().min(0).max(1),
            evidence: z.string().trim().min(1).max(400),
          })
          .strict()
      )
      .max(20),
    warnings: z.array(z.string().trim().min(1).max(300)).max(10),
  })
  .strict();

const storedCandidateFactSchema = z
  .object({
    factDefinitionId: z.string().uuid().nullable(),
    factKey: z.string(),
    displayName: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    confidence: z.number().min(0).max(1),
    evidence: z.string(),
    outcome: z.enum([
      "CANDIDATE",
      "CONFLICTED",
      "PROTECTED",
      "UNMAPPED",
    ]),
  })
  .strict();

export const storedAssetAnalysisSchema = z
  .object({
    schemaVersion: z.literal(1),
    model: z.string(),
    responseId: z.string(),
    analyzedAt: z.string(),
    isProductRelevant: z.boolean().optional(),
    relevanceReason: z.string().optional(),
    summary: z.string(),
    visibleDetails: z.array(z.string()),
    candidateFacts: z.array(storedCandidateFactSchema),
    warnings: z.array(z.string()),
  })
  .strict();

export type ModelImageAnalysis = z.infer<typeof modelImageAnalysisSchema>;
export type StoredAssetAnalysis = z.infer<typeof storedAssetAnalysisSchema>;
export type StoredCandidateFact = z.infer<typeof storedCandidateFactSchema>;
