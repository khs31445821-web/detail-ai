"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

const PRODUCT_ASSETS_BUCKET = "product-assets";
const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 24 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const productSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120, "상품명은 120자 이내로 입력해주세요."),
});

type FieldErrors = {
  name?: string[];
  images?: string[];
};

export type CreateProductState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  values?: {
    name: string;
  };
};

class ProductCreationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProductCreationError";
  }
}

function sanitizeFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const rawBaseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const rawExtension = lastDot > 0 ? fileName.slice(lastDot).toLowerCase() : "";
  const extension = /^\.[a-z0-9]{1,8}$/.test(rawExtension)
    ? rawExtension
    : "";
  const baseName = rawBaseName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${baseName || "image"}${extension}`;
}

function getFormValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
  };
}

function getImages(formData: FormData) {
  return formData
    .getAll("images")
    .filter((value): value is File =>
      Boolean(
        value &&
          typeof value === "object" &&
          "arrayBuffer" in value &&
          "size" in value &&
          value.size > 0
      )
    );
}

function validateImages(images: File[]) {
  const errors: string[] = [];

  if (images.length > MAX_IMAGE_COUNT) {
    errors.push(`상품 이미지는 최대 ${MAX_IMAGE_COUNT}장까지 등록할 수 있어요.`);
  }

  const unsupportedFile = images.find(
    (file) => !ACCEPTED_IMAGE_TYPES.has(file.type)
  );
  if (unsupportedFile) {
    errors.push(
      `${unsupportedFile.name}: JPG, PNG, WEBP, GIF 파일만 등록할 수 있어요.`
    );
  }

  const oversizedFile = images.find((file) => file.size > MAX_IMAGE_SIZE);
  if (oversizedFile) {
    errors.push(`${oversizedFile.name}: 이미지 한 장은 5MB 이하여야 해요.`);
  }

  const totalSize = images.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
    errors.push("이미지 전체 용량은 24MB 이하여야 해요.");
  }

  return errors;
}

function deriveInitialProductName(name: string, images: File[]) {
  const trimmedName = name.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const firstImage = images[0];
  if (!firstImage) {
    return "새 상품";
  }

  const withoutExtension = firstImage.name.replace(/\.[^.]+$/, "");
  const readableName = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return readableName || "이미지 기반 상품";
}

async function cleanupFailedCreation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  productId: string | undefined,
  uploadedPaths: string[]
) {
  if (uploadedPaths.length > 0) {
    const { error } = await supabase.storage
      .from(PRODUCT_ASSETS_BUCKET)
      .remove(uploadedPaths);

    if (error) {
      console.error("상품 이미지 정리 실패:", error);
    }
  }

  if (!productId) {
    return;
  }

  const cleanupResults = await Promise.all([
    supabase.from("projects").delete().eq("product_id", productId),
    supabase.from("product_assets").delete().eq("product_id", productId),
  ]);

  cleanupResults.forEach(({ error }) => {
    if (error) {
      console.error("상품 연관 데이터 정리 실패:", error);
    }
  });

  const { error: productCleanupError } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("workspace_id", workspaceId);

  if (productCleanupError) {
    console.error("상품 정리 실패:", productCleanupError);
  }
}

export async function createProduct(
  _previousState: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  const values = getFormValues(formData);
  const parsedProduct = productSchema.safeParse(values);
  const images = getImages(formData);
  const imageErrors = validateImages(images);

  const hasName = Boolean(values.name.trim());
  const hasImages = images.length > 0;
  if (!hasName && !hasImages) {
    imageErrors.push("상품 사진 한 장 또는 상품명 중 하나는 입력해주세요.");
  }

  if (!parsedProduct.success || imageErrors.length > 0) {
    const fieldErrors = parsedProduct.success
      ? {}
      : parsedProduct.error.flatten().fieldErrors;

    return {
      status: "error",
      message: "상품 사진 한 장 또는 상품명만 있으면 시작할 수 있어요.",
      fieldErrors: {
        ...fieldErrors,
        ...(imageErrors.length > 0 ? { images: imageErrors } : {}),
      },
      values,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: "로그인이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.",
      values,
    };
  }

  let workspace;
  try {
    workspace = await getOrCreateWorkspace();
  } catch (error) {
    console.error("작업공간 확인 실패:", error);
    return {
      status: "error",
      message: "작업공간을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      values,
    };
  }

  if (!workspace) {
    return {
      status: "error",
      message: "작업공간을 찾을 수 없습니다. 다시 로그인해주세요.",
      values,
    };
  }

  const initialProductName = deriveInitialProductName(parsedProduct.data.name, images);
  let productId: string | undefined;
  let projectId: string | undefined;
  const uploadedPaths: string[] = [];

  try {
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        workspace_id: workspace.id,
        created_by: user.id,
        name: initialProductName,
        base_price: null,
        currency: "KRW",
        description: null,
      })
      .select("id")
      .single();

    if (productError || !product) {
      throw new ProductCreationError(
        "상품 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
        { cause: productError }
      );
    }

    productId = product.id;

    if (images.length > 0) {
      const assetRows = [];
      for (const [index, file] of images.entries()) {
        const storagePath = `${workspace.id}/products/${productId}/original/${randomUUID()}-${sanitizeFileName(file.name)}`;
        const fileBody = new Uint8Array(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_ASSETS_BUCKET)
          .upload(storagePath, fileBody, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new ProductCreationError(
            `${index + 1}번째 이미지를 업로드하지 못했습니다. 파일 형식과 용량을 확인해주세요.`,
            { cause: uploadError }
          );
        }

        uploadedPaths.push(storagePath);
        assetRows.push({
          product_id: productId,
          storage_path: storagePath,
          mime_type: file.type,
          metadata: {
            original_filename: file.name,
            file_size: file.size,
            sort_order: index,
          },
        });
      }

      const { error: assetsError } = await supabase
        .from("product_assets")
        .insert(assetRows);

      if (assetsError) {
        throw new ProductCreationError(
          "이미지 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
          { cause: assetsError }
        );
      }
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspace.id,
        product_id: productId,
        created_by: user.id,
        name: `${initialProductName} 상세페이지`,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      throw new ProductCreationError(
        "상세페이지 프로젝트를 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
        { cause: projectError }
      );
    }

    projectId = project.id;
  } catch (error) {
    console.error("상품 등록 실패:", error);
    await cleanupFailedCreation(
      supabase,
      workspace.id,
      productId,
      uploadedPaths
    );

    return {
      status: "error",
      message:
        error instanceof ProductCreationError
          ? error.message
          : "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      values,
    };
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}/analyze`);
}
