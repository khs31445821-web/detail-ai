import { notFound, redirect } from "next/navigation";

import { isAnthropicConfigured } from "@/lib/anthropic";
import { pageDocumentSchema } from "@/lib/page-document";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

import { SimpleEditorClient } from "./simple-editor-client";

export const maxDuration = 300;

type EditorPageProps = {
  params: Promise<{ projectId: string }>;
};

type ProductRelation = {
  id: string;
  name: string;
};

type AssetRow = {
  id: string;
  storage_path: string;
  metadata: unknown;
};

function isGeneratedAsset(metadata: unknown) {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      "asset_origin" in metadata &&
      metadata.asset_origin === "AI_GENERATED"
  );
}

function getGeneratedAssetLabel(metadata: unknown, index: number) {
  if (!metadata || typeof metadata !== "object") {
    return `AI 생성 이미지 ${index + 1}`;
  }
  const preset =
    "generation_preset" in metadata ? String(metadata.generation_preset) : "";
  if (preset === "DETAIL") return "AI 디테일 컷";
  if (preset === "LIFESTYLE") return "AI 라이프스타일 컷";
  if (preset === "STUDIO") return "AI 스튜디오 컷";
  return `AI 생성 이미지 ${index + 1}`;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      page_document,
      selected_strategy_id,
      products (id, name)
    `)
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (projectError) {
    throw new Error("프로젝트 정보를 불러오지 못했습니다.", {
      cause: projectError,
    });
  }
  if (!project) notFound();

  const productRelation = project.products as ProductRelation | ProductRelation[] | null;
  const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
  if (!product) notFound();

  const parsedDocument = pageDocumentSchema.safeParse(project.page_document);
  if (!parsedDocument.success) {
    redirect(`/projects/${projectId}/planner`);
  }

  const { data: assetRows, error: assetsError } = await supabase
    .from("product_assets")
    .select("id, storage_path, metadata")
    .eq("product_id", product.id)
    .order("created_at", { ascending: true });

  if (assetsError) {
    throw new Error("상품 이미지를 불러오지 못했습니다.", {
      cause: assetsError,
    });
  }

  const assets = (assetRows ?? []) as AssetRow[];
  const assetUrls: Record<string, string> = {};
  if (assets.length > 0) {
    const { data: signedAssets, error: signedAssetsError } =
      await supabase.storage
        .from("product-assets")
        .createSignedUrls(
          assets.map((asset) => asset.storage_path),
          60 * 60
        );

    if (signedAssetsError) {
      console.error("상품 이미지 signed URL 생성 실패:", signedAssetsError);
    } else {
      signedAssets?.forEach((signedAsset, index) => {
        if (signedAsset.signedUrl && assets[index]) {
          assetUrls[assets[index].id] = signedAsset.signedUrl;
        }
      });
    }
  }

  return (
    <SimpleEditorClient
      projectId={project.id}
      productName={product.name}
      initialDocument={parsedDocument.data}
      assetUrls={assetUrls}
      claudeConfigured={isAnthropicConfigured()}
      assets={assets.map((asset, index) => ({
        id: asset.id,
        label: isGeneratedAsset(asset.metadata)
          ? `${getGeneratedAssetLabel(asset.metadata, index)} · 생성됨`
          : `원본 상품 이미지 ${index + 1}`,
        kind: isGeneratedAsset(asset.metadata) ? "GENERATED" : "ORIGINAL",
      }))}
    />
  );
}
