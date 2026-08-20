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

const initialState: CreateProductState = { status: "idle" };

type SelectedImage = {
  file: File;
  id: string;
  previewUrl: string;
};

type CategoryOption = {
  key: string;
  displayName: string;
  parentKey: string | null;
};

export function ProductForm({ categories }: { categories: CategoryOption[] }) {
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
    if (!inputRef.current) return;
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
    const removed = selectedImages.find((image) => image.id === id);
    const nextImages = selectedImages.filter((image) => image.id !== id);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== removed.previewUrl
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
          <p className="font-semibold">확인할 내용이 있어요.</p>
          <p className="mt-1">{state.message}</p>
        </div>
      )}

      <section className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.06)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="grid gap-7 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <label
                htmlFor="images"
                className="group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-gradient-to-b from-violet-50/70 to-white px-6 py-10 text-center transition hover:border-violet-400 hover:bg-violet-50"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-2xl text-white shadow-lg shadow-violet-200 transition group-hover:-translate-y-0.5">
                  ↑
                </span>
                <span className="mt-5 text-base font-bold text-neutral-900">
                  상품 사진 올리기
                </span>
                <span className="mt-2 text-sm leading-6 text-neutral-500">
                  한 장만 있어도 시작할 수 있어요
                  <br />JPG, PNG, WEBP, GIF · 최대 6장
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
                <div className="mt-4 grid grid-cols-3 gap-3">
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
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="w-full px-2 py-2 text-xs font-semibold text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {imageErrors.length > 0 && (
                <p id="images-error" className="mt-3 text-sm font-medium text-red-600">
                  {imageErrors[0]}
                </p>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="name" className="text-sm font-bold text-neutral-800">
                  상품명
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  maxLength={120}
                  defaultValue={state.values?.name}
                  placeholder="예: 손잡이 스테인리스 텀블러"
                  className="mt-2.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
                {state.fieldErrors?.name && (
                  <p className="mt-2 text-sm text-red-600">{state.fieldErrors.name[0]}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="price" className="text-sm font-bold text-neutral-800">
                    판매가격
                  </label>
                  <span className="text-xs font-semibold text-neutral-400">선택</span>
                </div>
                <div className="relative mt-2.5">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-neutral-400">
                    ₩
                  </span>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min={0}
                    max={999999999}
                    step={1}
                    inputMode="numeric"
                    defaultValue={state.values?.price}
                    placeholder="24900"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3.5 pl-9 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>
                {state.fieldErrors?.price && (
                  <p className="mt-2 text-sm text-red-600">{state.fieldErrors.price[0]}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="description"
                    className="text-sm font-bold text-neutral-800"
                  >
                    상품 특징을 아는 만큼 적어주세요
                  </label>
                  <span className="text-xs font-semibold text-neutral-400">자유 입력</span>
                </div>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  maxLength={2000}
                  defaultValue={state.values?.description}
                  placeholder="예: 500ml 정도이고 손잡이가 있어요. 크림색이고 스테인리스 재질입니다. 식기세척기 사용 가능 여부는 잘 모르겠어요."
                  className="mt-2.5 w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  문장으로 편하게 적어도 됩니다. 다음 단계에서 AI가 항목별로 정리합니다.
                </p>
                {state.fieldErrors?.description && (
                  <p className="mt-2 text-sm text-red-600">
                    {state.fieldErrors.description[0]}
                  </p>
                )}
              </div>
            </div>
          </div>

          <details className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50 open:bg-white">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-bold text-neutral-700">
              상세 정보 직접 입력
              <span className="ml-2 text-xs font-normal text-neutral-400">
                알고 있을 때만 선택하세요
              </span>
            </summary>
            <div className="border-t border-neutral-200 p-4 sm:p-5">
              <label htmlFor="categoryKey" className="text-sm font-bold text-neutral-700">
                상품 카테고리
              </label>
              <select
                id="categoryKey"
                name="categoryKey"
                defaultValue={state.values?.categoryKey ?? ""}
                className="mt-2.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              >
                <option value="">AI 분석 단계에서 정하기</option>
                {categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.parentKey ? "↳ " : ""}
                    {category.displayName}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.categoryKey && (
                <p className="mt-2 text-sm text-red-600">
                  {state.fieldErrors.categoryKey[0]}
                </p>
              )}
            </div>
          </details>
        </div>

        <div className="border-t border-neutral-200 bg-neutral-950 px-6 py-6 text-white sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">아는 만큼만 알려주세요</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                AI가 정보를 정리한 뒤, 꼭 필요한 내용만 최대 3개까지 다시 물어봅니다.
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending || Boolean(clientImageError)}
              className="inline-flex min-w-52 items-center justify-center rounded-2xl bg-violet-500 px-6 py-4 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {isPending ? "상품을 준비하는 중..." : "AI 상품 분석 시작 →"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
