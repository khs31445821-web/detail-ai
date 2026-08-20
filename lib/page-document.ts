import { z } from "zod";

export const blockVariantSchema = z.enum([
  "hero_01",
  "hero_02",
  "hero_03",
  "benefit_01",
  "benefit_02",
  "benefit_03",
  "image_text_01",
  "image_text_02",
  "image_text_03",
  "feature_01",
  "feature_02",
  "spec_01",
  "spec_02",
  "size_01",
  "faq_01",
  "cta_01",
  "cta_02",
]);

export const conversionRoleSchema = z.enum([
  "ATTENTION",
  "RESONANCE",
  "VALUE",
  "PROOF",
  "DETAIL",
  "OBJECTION",
  "ACTION",
]);

const pageItemSchema = z
  .object({
    title: z.string().trim().max(100),
    description: z.string().trim().max(300),
    supportingFactIds: z.array(z.string().uuid()).max(8),
  })
  .strict();

const pageSpecSchema = z
  .object({
    factId: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    // 사이즈별 실측표처럼 여러 행이 필요한 보호 Fact도 원문을 잃지 않는다.
    value: z.string().trim().min(1).max(1000),
  })
  .strict();

const pageFaqSchema = z
  .object({
    question: z.string().trim().min(1).max(160),
    answer: z.string().trim().min(1).max(400),
    supportingFactIds: z.array(z.string().uuid()).max(8),
  })
  .strict();

export const modelPageSectionSchema = z
  .object({
    variant: blockVariantSchema,
    conversionRole: conversionRoleSchema,
    eyebrow: z.string().trim().max(80),
    headline: z.string().trim().min(1).max(160),
    body: z.string().trim().max(500),
    items: z.array(pageItemSchema).max(6),
    specs: z.array(pageSpecSchema).max(12),
    faqs: z.array(pageFaqSchema).max(8),
    ctaLabel: z.string().trim().max(60),
    assetId: z.string().uuid().nullable(),
    supportingFactIds: z.array(z.string().uuid()).max(12),
    tone: z.enum(["LIGHT", "SOFT", "DARK", "ACCENT"]),
    align: z.enum(["LEFT", "CENTER"]),
  })
  .strict();

const modelPageThemeSchema = z
  .object({
    mood: z.enum(["MODERN", "WARM", "MINIMAL", "PREMIUM", "PLAYFUL"]),
    primaryColor: z.enum(["INK", "VIOLET", "FOREST", "NAVY", "TERRACOTTA"]),
    radius: z.enum(["SOFT", "ROUND", "SHARP"]),
  })
  .strict();

const pageThemeSchema = modelPageThemeSchema
  .extend({
    brandColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullable()
      .default(null),
  })
  .strict();

const marketReferenceSourceSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    url: z.string().url().max(2000),
  })
  .strict();

export const marketResearchSchema = z
  .object({
    generatedAt: z.string().min(1),
    model: z.string().min(1),
    responseId: z.string().min(1),
    query: z.string().trim().min(1).max(500),
    summary: z.string().trim().min(1).max(12000),
    caveat: z.string().trim().min(1).max(500),
    sources: z.array(marketReferenceSourceSchema).max(10),
    popularitySignals: z
      .array(z.string().trim().min(1).max(300))
      .max(8)
      .default([]),
    reviewSatisfactions: z
      .array(z.string().trim().min(1).max(300))
      .max(8)
      .default([]),
    reviewComplaints: z
      .array(z.string().trim().min(1).max(300))
      .max(8)
      .default([]),
    detailPagePatterns: z
      .array(z.string().trim().min(1).max(300))
      .max(8)
      .default([]),
    strategyOpportunities: z
      .array(z.string().trim().min(1).max(300))
      .max(8)
      .default([]),
  })
  .strict();

export const modelPagePlanSchema = z
  .object({
    theme: modelPageThemeSchema,
    sections: z.array(modelPageSectionSchema).min(6).max(10),
  })
  .strict();

export const pageSectionSchema = modelPageSectionSchema
  .extend({
    id: z.string().uuid(),
    type: z.enum(["hero", "benefit", "image_text", "feature", "spec", "size", "faq", "cta"]),
  })
  .strict();

export const pageDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    strategyId: z.string().uuid(),
    generatedAt: z.string().min(1),
    model: z.string().min(1),
    responseId: z.string().min(1),
    safetyCorrections: z.array(z.string().min(1).max(240)).max(20),
    marketResearch: marketResearchSchema.nullable().default(null),
    theme: pageThemeSchema,
    sections: z.array(pageSectionSchema).min(1).max(20),
  })
  .strict();

export type BlockVariant = z.infer<typeof blockVariantSchema>;
export type ModelPagePlan = z.infer<typeof modelPagePlanSchema>;
export type PageDocument = z.infer<typeof pageDocumentSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;

export function getBlockType(variant: BlockVariant): PageSection["type"] {
  if (variant.startsWith("image_text")) {
    return "image_text";
  }

  return variant.split("_")[0] as PageSection["type"];
}
