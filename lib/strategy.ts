import { z } from "zod";

import { marketResearchSchema } from "@/lib/page-document";

export const strategyArchetypeSchema = z.enum([
  "LIFESTYLE",
  "FUNCTIONAL",
  "PRACTICAL",
  "VALUE",
  "PREMIUM",
  "PROBLEM_SOLUTION",
  "GIFTING",
  "TRUST",
]);

const strategyBenefitSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    supportingFactIds: z.array(z.string().uuid()).max(8),
  })
  .strict();

export const modelStrategySchema = z
  .object({
    archetype: strategyArchetypeSchema,
    name: z.string().trim().min(1).max(80),
    positioning: z.string().trim().min(1).max(240),
    targetCustomer: z.string().trim().min(1).max(180),
    oneLiner: z.string().trim().min(1).max(120),
    coreMessage: z.string().trim().min(1).max(400),
    tone: z.enum(["WARM", "CLEAR", "BOLD", "PREMIUM", "FRIENDLY"]),
    benefits: z.array(strategyBenefitSchema).min(2).max(4),
    keywords: z.array(z.string().trim().min(1).max(40)).min(3).max(8),
    supportingFactIds: z.array(z.string().uuid()).max(12),
    riskNotes: z.array(z.string().trim().min(1).max(240)).max(6),
  })
  .strict();

export const modelStrategySetSchema = z
  .object({
    strategies: z.array(modelStrategySchema).length(3),
  })
  .strict();

export const storedStrategySchema = modelStrategySchema
  .extend({
    schemaVersion: z.literal(1),
    model: z.string().min(1),
    responseId: z.string().min(1),
    createdAt: z.string().min(1),
    marketResearch: marketResearchSchema.nullable().default(null),
  })
  .strict();

export type ModelStrategy = z.infer<typeof modelStrategySchema>;
export type StoredStrategy = z.infer<typeof storedStrategySchema>;
