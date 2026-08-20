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
    <form
      action={formAction}
      className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="space-y-6">
        {state.status === "error" && state.message && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700"
          >
            <p className="font-semibold">상품을 등록하지 못했어요.</p>
            <p className="mt-1">{state.message}</p>
          </div>
        )}

        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
              Basic info
            </p>
            <h2 className="mt-2 text-xl font-bold">기본 상품 정보</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="text-sm font-semibold text-neutral-800"
              >
                상품명 <span className="text-violet-600">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={120}
                defaultValue={state.values?.name}
                placeholder="예: 제주 유기농 감귤 3kg"
                aria-describedby={
                  state.fieldErrors?.name ? "name-error" : undefined
                }
                className="mt-2.5 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              {state.fieldErrors?.name && (
                <p id="name-error" className="mt-2 text-sm text-red-600">
                  {state.fieldErrors.name[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="price"
                className="text-sm font-semibold text-neutral-800"
              >
                판매 가격 <span className="text-violet-600">*</span>
              </label>
              <div className="relative mt-2.5">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-neutral-500">
                  ₩
                </span>
                <input
                  id="price"
                  name="price"
                  type="number"
                  required
                  min={0}
                  max={999999999}
                  step={1}
                  inputMode="numeric"
                  defaultValue={state.values?.price}
                  placeholder="29900"
                  aria-describedby={
                    state.fieldErrors?.price ? "price-error" : undefined
                  }
                  className="w-full rounded-2xl border border-neutral-200 bg-white py-3.5 pl-9 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </div>
              {state.fieldErrors?.price && (
                <p id="price-error" className="mt-2 text-sm text-red-600">
                  {state.fieldErrors.price[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="description"
                className="text-sm font-semibold text-neutral-800"
              >
                간단 설명 <span className="text-violet-600">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                minLength={5}
                maxLength={2000}
                rows={6}
                defaultValue={state.values?.description}
                placeholder="상품의 특징, 소재, 구성, 사용 방법 등 고객이 꼭 알아야 할 내용을 적어주세요."
                aria-describedby={
                  state.fieldErrors?.description
                    ? "description-error"
                    : undefined
                }
                className="mt-2.5 w-full resize-y rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="text-xs leading-5 text-neutral-400">
                  검증 가능한 사실 위주로 입력하면 이후 AI 분석의 정확도가 높아져요.
                </p>
                <span className="shrink-0 text-xs text-neutral-400">
                  최대 2,000자
                </span>
              </div>
              {state.fieldErrors?.description && (
                <p
                  id="description-error"
                  className="mt-2 text-sm text-red-600"
                >
                  {state.fieldErrors.description[0]}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
              Product images
            </p>
            <h2 className="mt-2 text-xl font-bold">원본 상품 이미지</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              정면, 측면, 디테일, 구성품처럼 서로 다른 정보를 담은 이미지를
              등록해주세요.
            </p>
          </div>

          <label
            htmlFor="images"
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center transition hover:border-violet-300 hover:bg-violet-50/50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              ↑
            </span>
            <span className="mt-4 text-sm font-semibold text-neutral-800">
              이미지를 선택해주세요
            </span>
            <span className="mt-1.5 text-xs leading-5 text-neutral-400">
              JPG, PNG, WEBP, GIF · 최대 6장 · 장당 5MB
            </span>
          </label>
          <input
            ref={inputRef}
            id="images"
            name="images"
            type="file"
            required
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImagesChange}
            className="sr-only"
            aria-describedby={imageErrors.length ? "images-error" : undefined}
          />

          {imageErrors.length > 0 && (
            <p
              id="images-error"
              className="mt-3 text-sm text-red-600"
              aria-live="polite"
            >
              {imageErrors[0]}
            </p>
          )}

          {selectedImages.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {selectedImages.map((image, index) => (
                <div
                  key={image.id}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div
                    role="img"
                    aria-label={`${index + 1}번째 상품 이미지 미리보기`}
                    className="aspect-[4/3] bg-neutral-100 bg-cover bg-center"
                    style={{ backgroundImage: `url(${image.previewUrl})` }}
                  />
                  <div className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-neutral-700">
                        상품 이미지 {index + 1}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`${index + 1}번째 상품 이미지 제거`}
                    >
                      제거
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-3xl bg-neutral-950 p-6 text-white shadow-xl lg:sticky lg:top-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Next step
        </p>
        <h2 className="mt-3 text-xl font-bold">AI 상품 분석</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          등록을 마치면 상품 Fact를 정리하고, 보호해야 할 Claim을 구분하는 분석
          단계로 이동합니다.
        </p>

        <div className="my-6 h-px bg-neutral-800" />

        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-bold">
              1
            </span>
            <span className="pt-0.5 font-medium">상품 정보 등록</span>
          </li>
          <li className="flex gap-3 text-neutral-500">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-xs font-bold">
              2
            </span>
            <span className="pt-0.5">AI 상품 분석</span>
          </li>
          <li className="flex gap-3 text-neutral-500">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-xs font-bold">
              3
            </span>
            <span className="pt-0.5">판매 전략 선택</span>
          </li>
        </ol>

        <button
          type="submit"
          disabled={isPending || Boolean(clientImageError)}
          className="mt-7 flex w-full items-center justify-center rounded-2xl bg-violet-500 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {isPending ? "상품과 이미지를 등록하는 중..." : "등록하고 AI 분석 시작"}
        </button>
        <p
          className="mt-3 text-center text-xs leading-5 text-neutral-500"
          aria-live="polite"
        >
          {isPending
            ? "이미지 수와 용량에 따라 잠시 걸릴 수 있어요."
            : "입력한 사실은 이후 단계에서도 보호됩니다."}
        </p>
      </aside>
    </form>
  );
}
