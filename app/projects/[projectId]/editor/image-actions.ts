"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { toFile } from "openai";
import { z } from "zod";

import {
  getImageGenerationModel,
  getOpenAIClient,
} from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

const PRODUCT_ASSETS_BUCKET = "product-assets";
const MAX_SOURCE_SIZE = 50 * 1024 * 1024;

const generationInputSchema = z
  .object({
    sourceAssetId: z.string().uuid(),
    preset: z.enum(["STUDIO", "DETAIL", "LIFESTYLE"]),
    quality: z.enum(["low", "medium", "high"]).default("medium"),
    direction: z.string().trim().max(500).default(""),
    externalImageConsent: z.literal(true),
  })
  .strict();

type ProductRelation = {
  id: string;
  name: string;
  description: string | null;
  category_key: string | null;
};

type FactRow = {
  value_json: unknown;
  fact_definitions:
    | { key: string; display_name: string }
    | Array<{ key: string; display_name: string }>
    | null;
};

export type GeneratedImageAsset = {
  id: string;
  label: string;
  url: string;
  kind: "GENERATED";
};

export type ImageGenerationResult = {
  status: "success" | "error";
  message: string;
  asset?: GeneratedImageAsset;
};

function getRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function displayValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function getPresetConfig(preset: z.infer<typeof generationInputSchema>["preset"]) {
  if (preset === "DETAIL") {
    return {
      label: "AI 디테일 컷",
      size: "1536x1024" as const,
      direction:
        "Create a restrained editorial close-up that clearly shows one real, visible material or construction detail from the source. Use soft directional light and a quiet neutral background.",
    };
  }
  if (preset === "LIFESTYLE") {
    return {
      label: "AI 라이프스타일 컷",
      size: "1536x1024" as const,
      direction:
        "Place the same product in a calm, premium, believable everyday setting. Keep the product dominant and do not introduce people when the source does not contain a person.",
    };
  }
  return {
    label: "AI 스튜디오 컷",
    size: "1024x1536" as const,
    direction:
      "Create a premium Korean commerce studio photograph with generous negative space, soft diffused light, subtle shadows, and a warm off-white seamless background.",
  };
}

function getGenerationErrorMessage(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : undefined;
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";

  if (status === 401) return "OpenAI API 키가 유효하지 않습니다.";
  if (status === 402 || /billing|credit/i.test(message)) {
    return "OpenAI 이미지 생성 크레딧 또는 결제 설정을 확인해주세요.";
  }
  if (status === 403) {
    return "OpenAI 조직 인증 또는 이미지 모델 접근 권한을 확인해주세요.";
  }
  if (status === 429) {
    return "OpenAI 사용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (/safety|moderation|policy/i.test(message)) {
    return "이미지 안전 정책으로 생성하지 못했습니다. 연출 지시를 바꿔주세요.";
  }
  return "이미지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

export async function generateProjectImage(
  projectId: string,
  input: unknown
): Promise<ImageGenerationResult> {
  const parsedProjectId = z.string().uuid().safeParse(projectId);
  const parsedInput = generationInputSchema.safeParse(input);
  if (!parsedProjectId.success || !parsedInput.success) {
    return { status: "error", message: "이미지 생성 요청 형식이 올바르지 않습니다." };
  }

  const openAI = getOpenAIClient();
  if (!openAI) {
    return { status: "error", message: "OpenAI API 키가 설정되지 않았습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "로그인이 만료되었습니다." };

  let uploadedPath: string | null = null;
  try {
    const workspace = await getOrCreateWorkspace();
    if (!workspace) {
      return { status: "error", message: "작업공간을 확인하지 못했습니다." };
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        products (id, name, description, category_key)
      `)
      .eq("id", parsedProjectId.data)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (projectError) throw projectError;

    const product = getRelation(
      project?.products as ProductRelation | ProductRelation[] | null
    );
    if (!project || !product) {
      return { status: "error", message: "상품 프로젝트를 찾을 수 없습니다." };
    }

    const [assetResult, factsResult] = await Promise.all([
      supabase
        .from("product_assets")
        .select("id, storage_path, mime_type, metadata")
        .eq("id", parsedInput.data.sourceAssetId)
        .eq("product_id", product.id)
        .like(
          "storage_path",
          `${workspace.id}/products/${product.id}/original/%`
        )
        .maybeSingle(),
      supabase
        .from("product_facts")
        .select(`
          value_json,
          fact_definitions (key, display_name)
        `)
        .eq("product_id", product.id)
        .eq("status", "CONFIRMED"),
    ]);
    if (assetResult.error) throw assetResult.error;
    if (factsResult.error) throw factsResult.error;
    if (!assetResult.data) {
      return {
        status: "error",
        message: "이 상품의 원본 이미지만 생성 기준으로 사용할 수 있습니다.",
      };
    }

    const { data: sourceBlob, error: downloadError } = await supabase.storage
      .from(PRODUCT_ASSETS_BUCKET)
      .download(assetResult.data.storage_path);
    if (downloadError || !sourceBlob) throw downloadError;

    const mimeType = assetResult.data.mime_type || sourceBlob.type;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(mimeType)) {
      return {
        status: "error",
        message: "AI 생성 기준 이미지는 JPG, PNG, WEBP 형식이어야 합니다.",
      };
    }
    if (sourceBlob.size > MAX_SOURCE_SIZE) {
      return { status: "error", message: "기준 이미지는 50MB 이하여야 합니다." };
    }

    const facts = ((factsResult.data ?? []) as FactRow[]).map((fact) => {
      const definition = getRelation(fact.fact_definitions);
      return {
        key: definition?.key ?? "fact",
        name: definition?.display_name ?? "상품 정보",
        value: displayValue(fact.value_json),
      };
    });
    const preset = getPresetConfig(parsedInput.data.preset);
    const fashion = product.category_key?.startsWith("FASHION") === true;
    const prompt = [
      "Edit the supplied product photo into one new commercial photo. The supplied product is the immutable visual reference.",
      "Preserve the exact product identity: color, silhouette, proportions, materials visible in the source, seams, pockets, closures, pattern, hardware, labels, and all existing construction details. Do not add or remove product features. Do not invent text, logos, accessories, packaging, claims, measurements, or variants.",
      fashion
        ? "For apparel, preserve the garment cut and every visible construction detail precisely. Do not change sleeve, collar, hem, fit, fabric appearance, or color. If a person is visible, avoid an identifiable face and do not change the garment to fit an invented body shape."
        : "For non-apparel, preserve the exact shape, scale relationships, finish, controls, openings, included parts, and visible function. Do not imply unconfirmed functionality.",
      preset.direction,
      "Keep the result natural, photorealistic, calm, premium, and suitable for a Korean product detail page. No captions, typography, watermarks, borders, collage, or graphic UI.",
      parsedInput.data.direction
        ? `Additional art direction (must not override product identity): ${parsedInput.data.direction}`
        : "",
      `Product context: ${JSON.stringify({
        name: product.name,
        description: product.description,
        category: product.category_key,
        confirmedFacts: facts,
      })}`,
    ]
      .filter(Boolean)
      .join("\n");

    const model = getImageGenerationModel();
    const sourceBytes = Buffer.from(await sourceBlob.arrayBuffer());
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const sourceFile = await toFile(sourceBytes, `product-source.${extension}`, {
      type: mimeType,
    });
    const response = await openAI.images.edit({
      model,
      image: sourceFile,
      prompt,
      size: preset.size,
      quality: parsedInput.data.quality,
      output_format: "webp",
      output_compression: 88,
      background: "opaque",
      user: user.id,
    });
    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error("OpenAI가 이미지 데이터를 반환하지 않았습니다.");

    const outputBytes = Buffer.from(base64, "base64");
    const generatedId = randomUUID();
    uploadedPath = `${workspace.id}/products/${product.id}/generated/${generatedId}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_ASSETS_BUCKET)
      .upload(uploadedPath, outputBytes, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: insertedAsset, error: insertError } = await supabase
      .from("product_assets")
      .insert({
        product_id: product.id,
        storage_path: uploadedPath,
        mime_type: "image/webp",
        metadata: {
          original_filename: `${preset.label}.webp`,
          file_size: outputBytes.byteLength,
          asset_origin: "AI_GENERATED",
          generation_provider: "openai",
          generation_model: model,
          generation_preset: parsedInput.data.preset,
          generation_quality: parsedInput.data.quality,
          source_asset_id: assetResult.data.id,
          prompt,
          created_by: user.id,
        },
      })
      .select("id")
      .single();
    if (insertError || !insertedAsset) throw insertError;

    const { data: signed, error: signedError } = await supabase.storage
      .from(PRODUCT_ASSETS_BUCKET)
      .createSignedUrl(uploadedPath, 60 * 60);
    if (signedError || !signed.signedUrl) {
      await supabase.from("product_assets").delete().eq("id", insertedAsset.id);
      throw signedError;
    }

    revalidatePath(`/projects/${project.id}/editor`);
    revalidatePath(`/projects/${project.id}/planner`);
    return {
      status: "success",
      message: `${preset.label}을 생성해 상품 이미지 보관함에 저장했습니다.`,
      asset: {
        id: insertedAsset.id,
        label: `${preset.label} · 생성됨`,
        url: signed.signedUrl,
        kind: "GENERATED",
      },
    };
  } catch (error) {
    console.error("AI 상품 이미지 생성 실패:", error);
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage
        .from(PRODUCT_ASSETS_BUCKET)
        .remove([uploadedPath]);
      if (cleanupError) console.error("생성 이미지 정리 실패:", cleanupError);
    }
    return { status: "error", message: getGenerationErrorMessage(error) };
  }
}
