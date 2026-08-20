"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { createProduct, type CreateProductState } from "./actions";

const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 24 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const initialState: CreateProductState = {
  status: "idle",
};

type SelectedImage = {
  file: File;
  id: string;
  previewUrl: string;
};

export function ProductForm() {
  const [state, formAction, isPending] = useActionState(
    createProduct,
    initialState
  );
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [clientImageError, setClientImageError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function replaceInputFiles(images: SelectedImage[]) {
    if (!inputRef.current) {
      return;
    }

    const transfer = new DataTransfer();
    images.forEach(({ file }) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
  }

  function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length > MAX_IMAGE_COUNT) {
      setClientImageError(`이미지는 최대 ${MAX_IMAGE_COUNT}장까지 등록할 수 있어요.`);
      event.target.value = "";
      return;
    }

    const unsupportedFile = files.find(
      (file) => !ACCEPTED_IMAGE_TYPES.has(file.type)
    );
    if (unsupportedFile) {
      setClientImageError("JPG, PNG, WEBP, GIF 이미지만 등록할 수 있어요.");
      event.target.value = "";
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_IMAGE_SIZE);
    if (oversizedFile) {
      setClientImageError("이미지 한 장의 최대 크기는 5MB예요.");
      event.target.value = "";
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
      setClientImageError("이미지 전체 용량은 24MB 이하여야 해요.");
      event.target.value = "";
      return;
    }

    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));

    const nextImages = files.map((file, index) => ({
      file,
      id: `${crypto.randomUUID()}-${index}`,
      previewUrl: URL.createObjectURL(file),
    }));

    previewUrlsRef.current = nextImages.map(({ previewUrl }) => previewUrl);
    setSelectedImages(nextImages);
    setClientImageError(undefined);
  }

  function removeImage(id: string) {
    const removedImage = selectedImages.find((image) => image.id === id);
    const nextImages = selectedImages.filter((image) => image.id !== id);

    if (removedImage) {
      URL.revokeObjectURL(removedImage.previewUrl);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== removedImage.previewUrl
      );
    }

    setSelectedImages(nextImages);
    replaceInputFiles(nextImages);
    setClientImageError(undefined);
  }

  const imageErrors = [
    ...(state.fieldErrors?.images ?? []),
    ...(clientImageError ? [clientImageError] : []),
  ];

  return (
    <form action={formAction} className="mx-auto max-w-4xl">
      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700"
        >
          <p className="font-semibold">시작하지 못했어요.</p>
          <p className="mt-1">{state.message}</p>
        </div>
      )}

      <section className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.06)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
              가장 빠른 시작
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
              사진 한 장만 올려도 충분해요
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500 sm:text-base">
              상품 사진 또는 상품명 중 하나만 입력하면 AI가 상품을 이해하고,
              판매기획·카피·디자인 방향·상세페이지 구조까지 이어서 만듭니다.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl">
            <label
              htmlFor="images"
              className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-gradient-to-b from-violet-50/70 to-white px-6 py-10 text-center transition hover:border-violet-400 hover:bg-violet-50"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-3xl text-white shadow-lg shadow-violet-200 transition group-hover:-translate-y-0.5">
                ↑
              </span>
              <span className="mt-5 text-base font-bold text-neutral-900">
                상품 사진 업로드
              </span>
              <span className="mt-2 text-sm leading-6 text-neutral-500">
                사진 한 장이면 바로 시작할 수 있어요
                <br />
                JPG, PNG, WEBP, GIF · 최대 6장
              </span>
            </label>
            <input
              ref={inputRef}
              id="images"
              name="images"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImagesChange}
              className="sr-only"
              aria-describedby={imageErrors.length ? "images-error" : undefined}
            />

            {selectedImages.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {selectedImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                  >
                    <div
                      role="img"
                      aria-label={`${index + 1}번째 상품 이미지 미리보기`}
                      className="aspect-square bg-neutral-100 bg-cover bg-center"
                      style={{ backgroundImage: `url(${image.previewUrl})` }}
                    />
                    <div className="flex items-center justify-between gap-2 p-3">
                      <span className="truncate text-xs font-semibold text-neutral-600">
                        이미지 {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        제거
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {imageErrors.length > 0 && (
              <p
                id="images-error"
                className="mt-3 text-sm font-medium text-red-600"
                aria-live="polite"
              >
                {imageErrors[0]}
              </p>
            )}

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-neutral-200" />
              <span className="text-xs font-bold tracking-[0.16em] text-neutral-400">
                또는
              </span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>

            <div>
              <label
                htmlFor="name"
                className="text-sm font-bold text-neutral-800"
              >
                상품명만 입력
              </label>
              <input
                id="name"
                name="name"
                type="text"
                maxLength={120}
                defaultValue={state.values?.name}
                placeholder="예: 손잡이 스테인리스 텀블러"
                aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
                className="mt-2.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-base outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
              {state.fieldErrors?.name && (
                <p id="name-error" className="mt-2 text-sm text-red-600">
                  {state.fieldErrors.name[0]}
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-neutral-400">
                사진과 상품명을 둘 다 넣으면 분석 정확도가 더 좋아집니다.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 bg-neutral-950 px-6 py-6 text-white sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">AI가 다음 작업을 이어서 합니다</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                상품 이해 → 판매 포인트 → 카피 → 디자인 구조 → 상세페이지
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending || Boolean(clientImageError)}
              className="inline-flex min-w-52 items-center justify-center rounded-2xl bg-violet-500 px-6 py-4 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {isPending ? "상품을 준비하는 중..." : "상세페이지 만들기 →"}
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-500" aria-live="polite">
            목표 생성 시간 1~3분 · 부족한 정보만 나중에 짧게 확인합니다.
          </p>
        </div>
      </section>
    </form>
  );
}
