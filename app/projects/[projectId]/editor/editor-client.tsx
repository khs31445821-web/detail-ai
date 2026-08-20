"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";

import { PageRenderer } from "@/components/page-blocks/block-renderer";
import {
  executePageCommand,
  type PageCommand,
  type PageFieldTarget,
} from "@/lib/page-commands";
import type {
  BlockVariant,
  PageDocument,
  PageSection,
} from "@/lib/page-document";

import {
  savePageDocument,
  type EditorSaveState,
} from "./actions";
import {
  runPageCopilot,
  type PageCopilotResult,
} from "./copilot-actions";
import {
  runClaudeDesignDirector,
  type ClaudeDesignResult,
} from "./design-actions";
import {
  generateProjectImage,
  type ImageGenerationResult,
} from "./image-actions";

type EditorAsset = {
  id: string;
  label: string;
  kind: "ORIGINAL" | "GENERATED";
};

type EditorClientProps = {
  projectId: string;
  productName: string;
  initialDocument: PageDocument;
  assetUrls: Record<string, string>;
  assets: EditorAsset[];
  claudeConfigured: boolean;
};

type EditorHistory = {
  past: PageDocument[];
  present: PageDocument;
  future: PageDocument[];
};

const initialSaveState: EditorSaveState = {
  status: "idle",
  message: "",
};

const variantOptions: Record<PageSection["type"], BlockVariant[]> = {
  hero: ["hero_01", "hero_02", "hero_03"],
  benefit: ["benefit_01", "benefit_02", "benefit_03"],
  image_text: ["image_text_01", "image_text_02", "image_text_03"],
  feature: ["feature_01", "feature_02"],
  spec: ["spec_01", "spec_02"],
  size: ["size_01"],
  faq: ["faq_01"],
  cta: ["cta_01", "cta_02"],
};

const brandColorPresets: Array<{
  key: PageDocument["theme"]["primaryColor"];
  label: string;
  hex: string;
}> = [
  { key: "INK", label: "잉크", hex: "#4A4A45" },
  { key: "VIOLET", label: "뮤트 바이올렛", hex: "#6D6577" },
  { key: "FOREST", label: "세이지", hex: "#657064" },
  { key: "NAVY", label: "슬레이트 네이비", hex: "#5D6975" },
  { key: "TERRACOTTA", label: "테라코타", hex: "#8B6B5F" },
];

function BrandColorControl({
  theme,
  disabled,
  onChange,
}: {
  theme: PageDocument["theme"];
  disabled: boolean;
  onChange: (patch: Partial<PageDocument["theme"]>) => void;
}) {
  const preset =
    brandColorPresets.find((option) => option.key === theme.primaryColor) ??
    brandColorPresets[0];
  const currentColor = (theme.brandColor ?? preset.hex).toUpperCase();
  const [draftState, setDraftState] = useState({
    source: currentColor,
    value: currentColor,
  });
  const draftColor =
    draftState.source === currentColor ? draftState.value : currentColor;

  const commitHex = () => {
    const normalized = draftColor.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(normalized)) {
      onChange({ brandColor: normalized });
      return;
    }
    setDraftState({ source: currentColor, value: currentColor });
  };

  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-neutral-700">브랜드 컬러</p>
          <p className="mt-1 text-[9px] leading-4 text-neutral-400">
            배경·강조·딥 컬러를 자동으로 조합합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-neutral-200">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: currentColor }}
          />
          <span className="font-mono text-[9px] font-bold text-neutral-600">
            {currentColor}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {brandColorPresets.map((option) => {
          const selected =
            theme.brandColor === null && theme.primaryColor === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({ primaryColor: option.key, brandColor: null })
              }
              aria-label={`${option.label} ${option.hex}`}
              title={option.label}
              className={`relative h-9 rounded-xl transition disabled:opacity-40 ${
                selected
                  ? "ring-2 ring-neutral-950 ring-offset-2"
                  : "ring-1 ring-black/10 hover:scale-105"
              }`}
              style={{ backgroundColor: option.hex }}
            >
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-[42px_1fr_auto] gap-2">
        <label
          className="relative overflow-hidden rounded-xl ring-1 ring-black/10"
          title="컬러 피커 열기"
          style={{ backgroundColor: currentColor }}
        >
          <span className="sr-only">브랜드 컬러 선택</span>
          <input
            type="color"
            value={currentColor}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setDraftState({ source: currentColor, value });
              onChange({ brandColor: value });
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </label>
        <input
          value={draftColor}
          disabled={disabled}
          onChange={(event) =>
            setDraftState({ source: currentColor, value: event.target.value })
          }
          onBlur={commitHex}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          aria-label="브랜드 컬러 HEX"
          maxLength={7}
          spellCheck={false}
          className="min-w-0 rounded-xl border border-neutral-200 bg-white px-3 font-mono text-[11px] font-bold uppercase text-neutral-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-neutral-100"
        />
        <button
          type="button"
          disabled={disabled || theme.brandColor === null}
          onClick={() => onChange({ brandColor: null })}
          className="rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-bold text-neutral-500 hover:bg-neutral-100 disabled:opacity-35"
        >
          기본값
        </button>
      </div>
    </div>
  );
}

function SortableSectionRow({
  section,
  index,
  selected,
  onSelect,
}: {
  section: PageSection;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const fixed = section.type === "hero" || section.type === "cta";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: fixed });
  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border p-2 transition ${
        selected
          ? "border-violet-300 bg-violet-50"
          : "border-transparent hover:border-neutral-200 hover:bg-neutral-50"
      } ${isDragging ? "z-20 opacity-60 shadow-lg" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-neutral-500 shadow-sm ring-1 ring-neutral-200">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-neutral-800">
            {section.headline}
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase text-neutral-400">
            {section.variant}
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled={fixed}
        aria-label={`${section.headline} 블록 이동`}
        title={fixed ? "Hero와 CTA 위치는 고정됩니다." : "드래그해서 이동"}
        {...attributes}
        {...listeners}
        className="cursor-grab rounded-lg px-2 py-2 text-sm text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-25"
      >
        ⠿
      </button>
    </div>
  );
}

function CommitField({
  label,
  value,
  onCommit,
  multiline = false,
  maxLength,
  disabled,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  maxLength: number;
  disabled: boolean;
}) {
  const [draftState, setDraftState] = useState({ source: value, value });
  const draft = draftState.source === value ? draftState.value : value;

  const commit = () => {
    const nextValue = draft.trim();
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  };
  const className =
    "mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs leading-5 text-neutral-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-neutral-100";

  return (
    <label className="block text-[11px] font-bold text-neutral-500">
      {label}
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) =>
            setDraftState({ source: value, value: event.target.value })
          }
          onBlur={commit}
          maxLength={maxLength}
          rows={4}
          disabled={disabled}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={draft}
          onChange={(event) =>
            setDraftState({ source: value, value: event.target.value })
          }
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          maxLength={maxLength}
          disabled={disabled}
          className={className}
        />
      )}
      <span className="mt-1 block text-right text-[9px] font-medium text-neutral-300">
        {draft.length}/{maxLength}
      </span>
    </label>
  );
}

export function EditorClient({
  projectId,
  productName,
  initialDocument,
  assetUrls,
  assets,
  claudeConfigured,
}: EditorClientProps) {
  const [history, setHistory] = useState<EditorHistory>({
    past: [],
    present: initialDocument,
    future: [],
  });
  const [selectedSectionId, setSelectedSectionId] = useState(
    initialDocument.sections[0]?.id ?? ""
  );
  const [savedDocument, setSavedDocument] = useState(initialDocument);
  const [copilotInstruction, setCopilotInstruction] = useState("");
  const [copilotScope, setCopilotScope] = useState<"SELECTED" | "PAGE">(
    "SELECTED"
  );
  const [copilotConsent, setCopilotConsent] = useState(false);
  const [copilotResult, setCopilotResult] =
    useState<PageCopilotResult | null>(null);
  const [copilotPending, startCopilotTransition] = useTransition();
  const [designPreset, setDesignPreset] = useState<
    "QUIET_LUXURY" | "FASHION_EDITORIAL" | "WARM_COMMERCE"
  >("QUIET_LUXURY");
  const [designInstruction, setDesignInstruction] = useState("");
  const [designConsent, setDesignConsent] = useState(false);
  const [designResult, setDesignResult] =
    useState<ClaudeDesignResult | null>(null);
  const [designPending, startDesignTransition] = useTransition();
  const [availableAssets, setAvailableAssets] = useState(assets);
  const [availableAssetUrls, setAvailableAssetUrls] = useState(assetUrls);
  const originalAssets = useMemo(
    () => availableAssets.filter((asset) => asset.kind === "ORIGINAL"),
    [availableAssets]
  );
  const [imageSourceId, setImageSourceId] = useState(
    assets.find((asset) => asset.kind === "ORIGINAL")?.id ?? ""
  );
  const [imagePreset, setImagePreset] = useState<
    "STUDIO" | "DETAIL" | "LIFESTYLE"
  >("STUDIO");
  const [imageQuality, setImageQuality] = useState<"low" | "medium" | "high">(
    "medium"
  );
  const [imageDirection, setImageDirection] = useState("");
  const [imageConsent, setImageConsent] = useState(false);
  const [imageResult, setImageResult] =
    useState<ImageGenerationResult | null>(null);
  const [imagePending, startImageTransition] = useTransition();
  const submittedDocumentRef = useRef(initialDocument);
  const boundSaveAction = savePageDocument.bind(null, projectId);
  const [saveState, saveFormAction, savePending] = useActionState(
    boundSaveAction,
    initialSaveState
  );
  const editorPending =
    savePending || copilotPending || imagePending || designPending;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const document = history.present;
  const selectedSection = useMemo(
    () =>
      document.sections.find((section) => section.id === selectedSectionId) ??
      document.sections[0],
    [document.sections, selectedSectionId]
  );
  const dirty = useMemo(
    () => JSON.stringify(document) !== JSON.stringify(savedDocument),
    [document, savedDocument]
  );

  useEffect(() => {
    if (saveState.status === "success" && saveState.savedAt) {
      setSavedDocument(submittedDocumentRef.current);
    }
  }, [saveState.savedAt, saveState.status]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const dispatch = useCallback((command: PageCommand) => {
    setHistory((current) => {
      const next = executePageCommand(current.present, command);
      if (next === current.present) {
        return current;
      }

      return {
        past: [...current.past.slice(-49), current.present],
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = () => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) {
        return current;
      }
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, 50),
      };
    });
  };

  const redo = () => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) {
        return current;
      }
      return {
        past: [...current.past.slice(-49), current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  };

  const updateField = (
    sectionId: string,
    target: PageFieldTarget,
    value: string
  ) => dispatch({ type: "UPDATE_FIELD", sectionId, target, value });

  const handleCopilot = () => {
    const instruction = copilotInstruction.trim();
    if (instruction.length < 3) {
      setCopilotResult({
        status: "error",
        message: "AI에게 요청할 내용을 3자 이상 입력해주세요.",
        commands: [],
      });
      return;
    }
    if (!copilotConsent) {
      setCopilotResult({
        status: "error",
        message: "PageDocument와 확정 Product Fact 전송에 동의해주세요.",
        commands: [],
      });
      return;
    }

    const requestedDocument = document;
    startCopilotTransition(async () => {
      const result = await runPageCopilot(projectId, {
        document: requestedDocument,
        instruction,
        selectedSectionId: selectedSection?.id ?? null,
        scope: copilotScope,
        externalEditingConsent: true,
      });
      setCopilotResult(result);

      if (result.status !== "success" || result.commands.length === 0) {
        return;
      }

      setHistory((current) => {
        const next = result.commands.reduce(
          (currentDocument, command) =>
            executePageCommand(currentDocument, command),
          current.present
        );
        return {
          past: [...current.past.slice(-49), current.present],
          present: next,
          future: [],
        };
      });
      const firstEditedSection = result.commands.find(
        (command) => "sectionId" in command
      );
      if (firstEditedSection && "sectionId" in firstEditedSection) {
        setSelectedSectionId(firstEditedSection.sectionId);
      }
    });
  };

  const handleClaudeDesign = () => {
    if (!designConsent) {
      setDesignResult({
        status: "error",
        message: "PageDocument 구조를 Claude API로 전송하는 데 동의해주세요.",
        commands: [],
      });
      return;
    }

    const requestedDocument = document;
    startDesignTransition(async () => {
      const result = await runClaudeDesignDirector(projectId, {
        document: requestedDocument,
        preset: designPreset,
        instruction: designInstruction,
        externalDesignConsent: true,
      });
      setDesignResult(result);
      if (result.status !== "success" || result.commands.length === 0) {
        return;
      }

      setHistory((current) => {
        const next = result.commands.reduce(
          (currentDocument, command) =>
            executePageCommand(currentDocument, command),
          current.present
        );
        return {
          past: [...current.past.slice(-49), current.present],
          present: next,
          future: [],
        };
      });
    });
  };

  const selectedSectionSupportsImage = Boolean(
    selectedSection &&
      (selectedSection.type === "hero" ||
        selectedSection.type === "image_text" ||
        selectedSection.variant === "feature_02")
  );

  const handleImageGeneration = () => {
    if (!imageSourceId) {
      setImageResult({
        status: "error",
        message: "생성 기준으로 사용할 원본 상품 이미지를 선택해주세요.",
      });
      return;
    }
    if (!imageConsent) {
      setImageResult({
        status: "error",
        message: "원본 이미지와 확정 Product Fact 전송에 동의해주세요.",
      });
      return;
    }

    const targetSectionId = selectedSection?.id ?? null;
    const shouldApply = selectedSectionSupportsImage && Boolean(targetSectionId);
    startImageTransition(async () => {
      const result = await generateProjectImage(projectId, {
        sourceAssetId: imageSourceId,
        preset: imagePreset,
        quality: imageQuality,
        direction: imageDirection,
        externalImageConsent: true,
      });

      if (result.status !== "success" || !result.asset) {
        setImageResult(result);
        return;
      }

      const generatedAsset = result.asset;
      setAvailableAssets((current) =>
        current.some((asset) => asset.id === generatedAsset.id)
          ? current
          : [...current, generatedAsset]
      );
      setAvailableAssetUrls((current) => ({
        ...current,
        [generatedAsset.id]: generatedAsset.url,
      }));

      if (shouldApply && targetSectionId) {
        dispatch({
          type: "SET_ASSET",
          sectionId: targetSectionId,
          assetId: generatedAsset.id,
        });
        setImageResult({
          ...result,
          message: `${result.message} 현재 블록 미리보기에 적용했습니다. 저장 버튼을 눌러 확정하세요.`,
        });
      } else {
        setImageResult({
          ...result,
          message: `${result.message} 이미지형 블록을 선택하면 보관함에서 적용할 수 있습니다.`,
        });
      }
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || editorPending) {
      return;
    }
    const toIndex = document.sections.findIndex(
      (section) => section.id === over.id
    );
    dispatch({
      type: "MOVE_SECTION",
      sectionId: String(active.id),
      toIndex,
    });
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.14em] text-violet-600">
              DETAIL AI EDITOR
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-sm font-bold text-neutral-900">
                {productName}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                  dirty
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {dirty ? "수정됨" : "저장됨"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={history.past.length === 0 || editorPending}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-35"
            >
              실행 취소
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={history.future.length === 0 || editorPending}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-35"
            >
              다시 실행
            </button>
            <Link
              href={`/projects/${projectId}/planner`}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Planner
            </Link>
            <form
              action={saveFormAction}
              onSubmit={() => {
                submittedDocumentRef.current = document;
              }}
            >
              <input
                type="hidden"
                name="document"
                value={JSON.stringify(document)}
              />
              <button
                type="submit"
                disabled={!dirty || editorPending}
                className="rounded-xl bg-neutral-950 px-4 py-2 text-xs font-black text-white hover:bg-neutral-800 disabled:bg-neutral-300"
              >
                {savePending ? "저장 중..." : "변경사항 저장"}
              </button>
            </form>
            <Link
              href="/dashboard"
              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
            >
              대시보드
            </Link>
          </div>
          {saveState.message && (
            <p
              role="status"
              className={`w-full text-right text-[11px] font-semibold ${
                saveState.status === "error"
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {saveState.message}
            </p>
          )}
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[270px_minmax(0,1fr)_330px]">
        <aside className="border-b border-neutral-200 bg-white p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
              Sections
            </p>
            <span className="text-[10px] font-bold text-neutral-400">
              {document.sections.length} blocks
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-neutral-400">
            가운데 블록을 드래그해 순서를 바꿀 수 있습니다. Hero와 CTA는
            전환 구조 보호를 위해 고정됩니다.
          </p>
          <DndContext
            id={`page-editor-${projectId}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={document.sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <nav className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {document.sections.map((section, index) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    index={index}
                    selected={section.id === selectedSection?.id}
                    onSelect={() => setSelectedSectionId(section.id)}
                  />
                ))}
              </nav>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            disabled={!dirty || editorPending}
            onClick={() => {
              setHistory({ past: [], present: savedDocument, future: [] });
              setSelectedSectionId(savedDocument.sections[0]?.id ?? "");
            }}
            className="mt-5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-bold text-neutral-500 hover:bg-neutral-50 disabled:opacity-35"
          >
            저장본으로 되돌리기
          </button>
        </aside>

        <div className="min-w-0 overflow-auto p-3 sm:p-7">
          <div className="mx-auto max-w-[1080px] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200">
            <PageRenderer
              document={document}
              assetUrls={availableAssetUrls}
              selectedSectionId={selectedSection?.id}
              onSectionSelect={setSelectedSectionId}
            />
          </div>
        </div>

        <aside className="border-t border-neutral-200 bg-white p-5 lg:border-l lg:border-t-0">
          <div className="sticky top-24 max-h-[calc(100vh-120px)] space-y-6 overflow-auto pr-1">
            <section className="overflow-hidden rounded-3xl bg-[#17151b] p-4 text-white shadow-xl shadow-violet-950/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7c7ff]">
                    Claude Design Director
                  </p>
                  <h2 className="mt-1 text-sm font-black">
                    전체 비주얼 리디렉션
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black text-neutral-300">
                  JSON Only
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-neutral-400">
                카피와 Fact는 유지하고 Block·톤·정렬·이미지 리듬만 Claude가
                다시 설계합니다. 결과는 저장 전 미리보기에 적용됩니다.
              </p>

              <div className="mt-4 grid gap-1.5 rounded-2xl bg-white/[0.05] p-1">
                {([
                  ["QUIET_LUXURY", "차분한 럭셔리", "여백과 절제된 대비"],
                  ["FASHION_EDITORIAL", "패션 에디토리얼", "큰 이미지와 비대칭 리듬"],
                  ["WARM_COMMERCE", "따뜻한 커머스", "명확한 구매 흐름"],
                ] as const).map(([preset, label, description]) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={editorPending}
                    onClick={() => setDesignPreset(preset)}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      designPreset === preset
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "text-neutral-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-[10px] font-black">{label}</span>
                    <span className="text-[9px] text-neutral-500">
                      {description}
                    </span>
                  </button>
                ))}
              </div>

              <textarea
                value={designInstruction}
                onChange={(event) => setDesignInstruction(event.target.value)}
                disabled={editorPending}
                maxLength={500}
                rows={3}
                placeholder="선택 입력 · 예: 생성 이미지는 Hero에, 원본은 디테일에 사용"
                className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-[10px] leading-4 text-white outline-none placeholder:text-neutral-600 focus:border-[#9d7bea] focus:ring-4 focus:ring-[#9d7bea]/10 disabled:opacity-50"
              />

              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[9px] leading-4 text-neutral-400">
                <input
                  type="checkbox"
                  checked={designConsent}
                  disabled={editorPending || !claudeConfigured}
                  onChange={(event) => setDesignConsent(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#9d7bea]"
                />
                <span>
                  비식별 PageDocument 구조, 이미지 ID와 공개 리서치 요약을
                  Anthropic Claude API로 전송하는 데 동의합니다. 상품 이미지와
                  Product Fact 원문은 보내지 않습니다.
                </span>
              </label>

              {!claudeConfigured && (
                <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-[9px] leading-4 text-amber-200">
                  ANTHROPIC_API_KEY를 설정하면 사용할 수 있습니다.
                </p>
              )}

              <button
                type="button"
                onClick={handleClaudeDesign}
                disabled={
                  editorPending || !claudeConfigured || !designConsent
                }
                className="mt-3 w-full rounded-2xl bg-[#8b68d5] px-4 py-3 text-xs font-black text-white transition hover:bg-[#9d7bea] disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {designPending
                  ? "Claude가 디자인 리듬을 설계 중..."
                  : "Claude 디자인 적용"}
              </button>

              {designResult && (
                <div
                  role={designResult.status === "error" ? "alert" : "status"}
                  className={`mt-3 rounded-2xl p-3 text-[10px] leading-4 ${
                    designResult.status === "error"
                      ? "bg-red-400/10 text-red-200"
                      : "bg-emerald-400/10 text-emerald-100"
                  }`}
                >
                  <p className="font-bold">{designResult.message}</p>
                  {designResult.direction && (
                    <div className="mt-2 border-t border-white/10 pt-2 text-neutral-300">
                      <p>{designResult.direction.rationale}</p>
                      <ul className="mt-2 space-y-1 text-[9px] text-neutral-400">
                        {designResult.direction.principles.map(
                          (principle, index) => (
                            <li key={`${principle}-${index}`}>
                              {index + 1}. {principle}
                            </li>
                          )
                        )}
                      </ul>
                      <p className="mt-2 text-[8px] uppercase tracking-[0.12em] text-neutral-600">
                        {designResult.direction.model}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-b from-stone-50 to-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                    AI Image Studio
                  </p>
                  <h2 className="mt-1 text-sm font-black text-neutral-950">
                    상품 사진 확장
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                  원본 보호
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-neutral-500">
                원본 형태와 CONFIRMED Fact를 고정한 채 상세페이지용 보조 컷을 만듭니다.
                생성본은 Fact 분석 근거로 사용하지 않습니다.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-stone-100 p-1">
                {([
                  ["STUDIO", "스튜디오"],
                  ["DETAIL", "디테일"],
                  ["LIFESTYLE", "라이프"],
                ] as const).map(([preset, label]) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={editorPending}
                    onClick={() => setImagePreset(preset)}
                    className={`rounded-xl px-2 py-2 text-[10px] font-black transition ${
                      imagePreset === preset
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                <label className="text-[10px] font-bold text-neutral-500">
                  기준 원본
                  <select
                    value={imageSourceId}
                    disabled={editorPending || originalAssets.length === 0}
                    onChange={(event) => setImageSourceId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2.5 text-[10px] font-bold outline-none focus:border-stone-400"
                  >
                    {originalAssets.length === 0 && (
                      <option value="">원본 없음</option>
                    )}
                    {originalAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-bold text-neutral-500">
                  품질
                  <select
                    value={imageQuality}
                    disabled={editorPending}
                    onChange={(event) =>
                      setImageQuality(
                        event.target.value as "low" | "medium" | "high"
                      )
                    }
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2.5 text-[10px] font-bold outline-none focus:border-stone-400"
                  >
                    <option value="low">빠르게</option>
                    <option value="medium">균형</option>
                    <option value="high">고품질</option>
                  </select>
                </label>
              </div>

              <textarea
                value={imageDirection}
                onChange={(event) => setImageDirection(event.target.value)}
                disabled={editorPending}
                maxLength={500}
                rows={3}
                placeholder="선택 입력 · 예: 웜그레이 배경, 오후의 부드러운 측광"
                className="mt-3 w-full resize-y rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-[10px] leading-4 text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-stone-400 focus:ring-4 focus:ring-stone-100"
              />

              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 text-[9px] leading-4 text-neutral-500">
                <input
                  type="checkbox"
                  checked={imageConsent}
                  disabled={editorPending}
                  onChange={(event) => setImageConsent(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-neutral-900"
                />
                <span>
                  원본 상품 이미지와 확정 Product Fact를 OpenAI Image API로
                  전송하고, 생성본을 Supabase에 저장하는 데 동의합니다.
                </span>
              </label>

              <button
                type="button"
                onClick={handleImageGeneration}
                disabled={
                  editorPending ||
                  !imageConsent ||
                  !imageSourceId ||
                  originalAssets.length === 0
                }
                className="mt-3 w-full rounded-2xl bg-neutral-950 px-4 py-3 text-xs font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {imagePending
                  ? "상품 정체성을 보호하며 생성 중..."
                  : selectedSectionSupportsImage
                    ? "생성 후 현재 블록에 적용"
                    : "생성해 이미지 보관함에 추가"}
              </button>

              {imageResult && (
                <p
                  role={imageResult.status === "error" ? "alert" : "status"}
                  className={`mt-3 rounded-xl px-3 py-2.5 text-[10px] leading-4 ${
                    imageResult.status === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {imageResult.message}
                </p>
              )}
            </section>

            <section className="rounded-3xl bg-neutral-950 p-4 text-white shadow-lg shadow-neutral-950/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
                    AI Command Copilot
                  </p>
                  <h2 className="mt-1 text-sm font-black">
                    말로 페이지 다듬기
                  </h2>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black text-neutral-300">
                  Fact Safe
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.06] p-1">
                {(["SELECTED", "PAGE"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    disabled={editorPending}
                    onClick={() => setCopilotScope(scope)}
                    className={`rounded-lg px-2 py-2 text-[10px] font-black transition ${
                      copilotScope === scope
                        ? "bg-white text-neutral-950"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {scope === "SELECTED" ? "현재 블록" : "페이지 전체"}
                  </button>
                ))}
              </div>

              <textarea
                value={copilotInstruction}
                onChange={(event) => setCopilotInstruction(event.target.value)}
                disabled={editorPending}
                maxLength={1000}
                rows={4}
                placeholder={
                  copilotScope === "SELECTED"
                    ? "예: 헤드라인을 더 고급스럽고 간결하게 바꿔줘"
                    : "예: 반복 표현을 줄이고 전체 문장 톤을 더 선명하게 정리해줘"
                }
                className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 py-3 text-xs leading-5 text-white outline-none placeholder:text-neutral-500 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10 disabled:opacity-50"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  "더 간결하게",
                  "더 고급스럽게",
                  "반복 표현 줄이기",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={editorPending}
                    onClick={() => setCopilotInstruction(preset)}
                    className="rounded-full border border-white/10 px-2.5 py-1.5 text-[9px] font-bold text-neutral-400 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-white/[0.05] p-3 text-[10px] leading-4 text-neutral-400">
                <input
                  type="checkbox"
                  checked={copilotConsent}
                  disabled={editorPending}
                  onChange={(event) => setCopilotConsent(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-violet-500"
                />
                <span>
                  편집을 위해 현재 PageDocument와 확정 Product Fact를 OpenAI
                  API로 전송하는 데 동의합니다. AI 결과는 저장 전 미리보기에만
                  적용됩니다.
                </span>
              </label>

              <button
                type="button"
                onClick={handleCopilot}
                disabled={
                  editorPending ||
                  !copilotConsent ||
                  copilotInstruction.trim().length < 3
                }
                className="mt-3 w-full rounded-xl bg-violet-500 px-4 py-3 text-xs font-black text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {copilotPending ? "AI 편집 명령 생성 중..." : "AI 편집 적용"}
              </button>

              {copilotResult && (
                <p
                  role={copilotResult.status === "error" ? "alert" : "status"}
                  className={`mt-3 rounded-xl px-3 py-2.5 text-[10px] leading-4 ${
                    copilotResult.status === "error"
                      ? "bg-red-400/10 text-red-200"
                      : "bg-emerald-400/10 text-emerald-200"
                  }`}
                >
                  {copilotResult.message}
                </p>
              )}
            </section>

            <section>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                Theme
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-[11px] font-bold text-neutral-500">
                  분위기
                  <select
                    value={document.theme.mood}
                    disabled={editorPending}
                    onChange={(event) =>
                      dispatch({
                        type: "CHANGE_THEME",
                        patch: {
                          mood: event.target.value as PageDocument["theme"]["mood"],
                        },
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold"
                  >
                    {(["MODERN", "WARM", "MINIMAL", "PREMIUM", "PLAYFUL"] as const).map(
                      (mood) => (
                        <option key={mood}>{mood}</option>
                      )
                    )}
                  </select>
                </label>
                <label className="text-[11px] font-bold text-neutral-500">
                  모서리 스타일
                  <select
                    value={document.theme.radius}
                    disabled={editorPending}
                    onChange={(event) =>
                      dispatch({
                        type: "CHANGE_THEME",
                        patch: {
                          radius:
                            event.target.value as PageDocument["theme"]["radius"],
                        },
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold"
                  >
                    <option value="SOFT">SOFT · 부드러운 카드</option>
                    <option value="ROUND">ROUND · 풍부한 곡선</option>
                    <option value="SHARP">SHARP · 에디토리얼 직선</option>
                  </select>
                </label>
              </div>
              <BrandColorControl
                theme={document.theme}
                disabled={editorPending}
                onChange={(patch) =>
                  dispatch({ type: "CHANGE_THEME", patch })
                }
              />
            </section>

            {selectedSection && (
              <section className="border-t border-neutral-200 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-600">
                      Inspector
                    </p>
                    <h2 className="mt-1 text-base font-black text-neutral-950">
                      {selectedSection.variant}
                    </h2>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black text-neutral-500">
                    {selectedSection.conversionRole}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <label className="text-[11px] font-bold text-neutral-500">
                    Variant
                    <select
                      value={selectedSection.variant}
                      disabled={editorPending}
                      onChange={(event) =>
                        dispatch({
                          type: "SET_VARIANT",
                          sectionId: selectedSection.id,
                          variant: event.target.value as BlockVariant,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {variantOptions[selectedSection.type].map((variant) => (
                        <option key={variant}>{variant}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-bold text-neutral-500">
                    Tone
                    <select
                      value={selectedSection.tone}
                      disabled={editorPending}
                      onChange={(event) =>
                        dispatch({
                          type: "SET_STYLE",
                          sectionId: selectedSection.id,
                          tone: event.target.value as PageSection["tone"],
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {(["LIGHT", "SOFT", "DARK", "ACCENT"] as const).map(
                        (tone) => (
                          <option key={tone}>{tone}</option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  <CommitField
                    label="Eyebrow"
                    value={selectedSection.eyebrow}
                    maxLength={80}
                    disabled={editorPending}
                    onCommit={(value) =>
                      updateField(
                        selectedSection.id,
                        { kind: "section", field: "eyebrow" },
                        value
                      )
                    }
                  />
                  <CommitField
                    label="Headline"
                    value={selectedSection.headline}
                    maxLength={160}
                    disabled={editorPending}
                    onCommit={(value) =>
                      updateField(
                        selectedSection.id,
                        { kind: "section", field: "headline" },
                        value
                      )
                    }
                  />
                  <CommitField
                    label="Body"
                    value={selectedSection.body}
                    maxLength={500}
                    multiline
                    disabled={editorPending}
                    onCommit={(value) =>
                      updateField(
                        selectedSection.id,
                        { kind: "section", field: "body" },
                        value
                      )
                    }
                  />
                  <CommitField
                    label="CTA Label"
                    value={selectedSection.ctaLabel}
                    maxLength={60}
                    disabled={editorPending}
                    onCommit={(value) =>
                      updateField(
                        selectedSection.id,
                        { kind: "section", field: "ctaLabel" },
                        value
                      )
                    }
                  />
                </div>

                <label className="mt-4 block text-[11px] font-bold text-neutral-500">
                  상품 이미지
                  <select
                    value={selectedSection.assetId ?? ""}
                    disabled={editorPending}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_ASSET",
                        sectionId: selectedSection.id,
                        assetId: event.target.value || null,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold"
                  >
                    <option value="">이미지 없음</option>
                    {availableAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedSection.items.length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-neutral-200 pt-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      Items
                    </p>
                    {selectedSection.items.map((item, index) => (
                      <div key={`${selectedSection.id}-item-${index}`} className="rounded-2xl bg-neutral-50 p-3">
                        <CommitField
                          label={`항목 ${index + 1} 제목`}
                          value={item.title}
                          maxLength={100}
                          disabled={editorPending}
                          onCommit={(value) =>
                            updateField(
                              selectedSection.id,
                              { kind: "item", index, field: "title" },
                              value
                            )
                          }
                        />
                        <CommitField
                          label={`항목 ${index + 1} 설명`}
                          value={item.description}
                          maxLength={300}
                          multiline
                          disabled={editorPending}
                          onCommit={(value) =>
                            updateField(
                              selectedSection.id,
                              { kind: "item", index, field: "description" },
                              value
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedSection.faqs.length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-neutral-200 pt-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      FAQ
                    </p>
                    {selectedSection.faqs.map((faq, index) => (
                      <div key={`${selectedSection.id}-faq-${index}`} className="rounded-2xl bg-neutral-50 p-3">
                        <CommitField
                          label={`질문 ${index + 1}`}
                          value={faq.question}
                          maxLength={160}
                          disabled={editorPending}
                          onCommit={(value) =>
                            updateField(
                              selectedSection.id,
                              { kind: "faq", index, field: "question" },
                              value
                            )
                          }
                        />
                        <CommitField
                          label="답변"
                          value={faq.answer}
                          maxLength={400}
                          multiline
                          disabled={editorPending}
                          onCommit={(value) =>
                            updateField(
                              selectedSection.id,
                              { kind: "faq", index, field: "answer" },
                              value
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedSection.specs.length > 0 && (
                  <div className="mt-6 border-t border-neutral-200 pt-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-400">
                      Protected Specs
                    </p>
                    <dl className="mt-3 space-y-2">
                      {selectedSection.specs.map((spec) => (
                        <div
                          key={spec.factId}
                          className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs"
                        >
                          <dt className="font-bold text-emerald-700">
                            {spec.label}
                          </dt>
                          <dd className="text-right font-black text-emerald-950">
                            {spec.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-[10px] leading-4 text-emerald-700">
                      Spec은 Product Brain의 CONFIRMED 값으로만 저장됩니다.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
