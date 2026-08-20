"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { PageRenderer } from "@/components/page-blocks/block-renderer";
import {
  executePageCommand,
  type PageCommand,
  type PageFieldTarget,
} from "@/lib/page-commands";
import type { PageDocument, PageSection } from "@/lib/page-document";

import {
  savePageDocument,
  type EditorSaveState,
} from "./actions";
import { runPageCopilot, type PageCopilotResult } from "./copilot-actions";
import {
  runClaudeDesignDirector,
  type ClaudeDesignResult,
} from "./design-actions";
import { EditorClient } from "./editor-client";
import {
  generateProjectImage,
  type ImageGenerationResult,
} from "./image-actions";

type EditorAsset = {
  id: string;
  label: string;
  kind: "ORIGINAL" | "GENERATED";
};

type SimpleEditorClientProps = {
  projectId: string;
  productName: string;
  initialDocument: PageDocument;
  assetUrls: Record<string, string>;
  assets: EditorAsset[];
  claudeConfigured: boolean;
};

type Panel = "content" | "design" | "image";

type History = {
  past: PageDocument[];
  present: PageDocument;
  future: PageDocument[];
};

const initialSaveState: EditorSaveState = {
  status: "idle",
  message: "",
};

const sectionLabels: Record<PageSection["type"], string> = {
  hero: "첫 화면",
  benefit: "핵심 장점",
  image_text: "상품 이야기",
  feature: "특징",
  spec: "상품 정보",
  size: "사이즈",
  faq: "자주 묻는 질문",
  cta: "마무리",
};

const designChoices = [
  {
    key: "clean",
    label: "깔끔한",
    description: "여백이 넓고 정돈된 느낌",
    preset: "QUIET_LUXURY" as const,
    instruction:
      "전체적으로 여백이 넓고 정돈된 한국 커머스 페이지처럼 구성해주세요. 장식을 줄이고 이미지와 문구의 우선순위를 명확하게 해주세요.",
  },
  {
    key: "premium",
    label: "프리미엄",
    description: "절제된 고급감과 큰 이미지",
    preset: "QUIET_LUXURY" as const,
    instruction:
      "더 프리미엄하게 보이도록 큰 이미지, 절제된 대비, 넓은 여백을 사용해주세요. 과도한 장식은 피해주세요.",
  },
  {
    key: "warm",
    label: "따뜻한",
    description: "부드럽고 친근한 구매 흐름",
    preset: "WARM_COMMERCE" as const,
    instruction:
      "따뜻하고 친근한 인상을 주되 상품 이해와 구매 흐름은 선명하게 유지해주세요.",
  },
  {
    key: "bold",
    label: "강한 강조",
    description: "큰 이미지와 선명한 메시지",
    preset: "FASHION_EDITORIAL" as const,
    instruction:
      "첫 인상을 더 강하게 만들고 핵심 문구와 이미지를 크게 강조해주세요. 읽기 어려운 실험적 구성은 피해주세요.",
  },
];

function applyCommands(document: PageDocument, commands: PageCommand[]) {
  return commands.reduce(
    (working, command) => executePageCommand(working, command),
    document
  );
}

function isImageSection(section: PageSection) {
  return (
    section.type === "hero" ||
    section.type === "image_text" ||
    section.variant === "feature_02"
  );
}

function getRecommendedImagePreset(section: PageSection) {
  if (section.type === "feature" || section.type === "spec") {
    return "DETAIL" as const;
  }
  if (section.type === "hero" || section.type === "image_text") {
    return "LIFESTYLE" as const;
  }
  return "STUDIO" as const;
}

function getImageDirection(section: PageSection) {
  if (section.type === "hero") {
    return "현재 상세페이지의 첫 인상에 맞게 상품이 주인공으로 보이는 자연스러운 메인 연출컷으로 만들어주세요.";
  }
  if (section.type === "image_text") {
    return "현재 문구의 분위기와 잘 어울리는 자연스러운 사용 장면으로 만들어주세요. 상품의 실제 형태와 색은 그대로 유지해주세요.";
  }
  return "현재 영역에서 보여주는 상품 특징이 더 잘 보이도록 자연스럽고 절제된 연출로 만들어주세요.";
}

function friendlyResultMessage(
  result: PageCopilotResult | ClaudeDesignResult | ImageGenerationResult | null
) {
  if (!result) return null;
  if (result.status === "success") return result.message;

  if (
    /api|provider|model|pagedocument|product fact|json/i.test(result.message)
  ) {
    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  return result.message;
}

function Field({
  label,
  value,
  multiline = false,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const className =
    "mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100";

  return (
    <label className="block text-xs font-bold text-neutral-600">
      {label}
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </label>
  );
}

export function SimpleEditorClient({
  projectId,
  productName,
  initialDocument,
  assetUrls,
  assets,
  claudeConfigured,
}: SimpleEditorClientProps) {
  const [history, setHistory] = useState<History>({
    past: [],
    present: initialDocument,
    future: [],
  });
  const [savedDocument, setSavedDocument] = useState(initialDocument);
  const [selectedSectionId, setSelectedSectionId] = useState(
    initialDocument.sections[0]?.id ?? ""
  );
  const [panel, setPanel] = useState<Panel>("content");
  const [advanced, setAdvanced] = useState(false);
  const [editorAssets, setEditorAssets] = useState(assets);
  const [editorAssetUrls, setEditorAssetUrls] = useState(assetUrls);
  const [copilotInstruction, setCopilotInstruction] = useState("");
  const [editingConsent, setEditingConsent] = useState(false);
  const [designConsent, setDesignConsent] = useState(false);
  const [imageConsent, setImageConsent] = useState(false);
  const [copilotResult, setCopilotResult] = useState<PageCopilotResult | null>(
    null
  );
  const [designResult, setDesignResult] = useState<ClaudeDesignResult | null>(
    null
  );
  const [imageResult, setImageResult] = useState<ImageGenerationResult | null>(
    null
  );
  const [copilotPending, startCopilot] = useTransition();
  const [designPending, startDesign] = useTransition();
  const [imagePending, startImage] = useTransition();

  const saveAction = savePageDocument.bind(null, projectId);
  const [saveState, saveFormAction, savePending] = useActionState(
    saveAction,
    initialSaveState
  );
  const submittedDocumentRef = useRef<PageDocument | null>(null);

  const document = history.present;
  const selectedSection = useMemo(
    () =>
      document.sections.find((section) => section.id === selectedSectionId) ??
      document.sections[0] ??
      null,
    [document, selectedSectionId]
  );
  const dirty = JSON.stringify(document) !== JSON.stringify(savedDocument);
  const busy = savePending || copilotPending || designPending || imagePending;

  useEffect(() => {
    if (saveState.status === "success" && submittedDocumentRef.current) {
      setSavedDocument(submittedDocumentRef.current);
    }
  }, [saveState]);

  function commit(nextDocument: PageDocument) {
    if (JSON.stringify(nextDocument) === JSON.stringify(document)) return;
    setHistory((current) => ({
      past: [...current.past, current.present].slice(-50),
      present: nextDocument,
      future: [],
    }));
  }

  function runCommand(command: PageCommand) {
    commit(executePageCommand(document, command));
  }

  function updateField(target: PageFieldTarget, value: string) {
    if (!selectedSection) return;
    runCommand({
      type: "UPDATE_FIELD",
      sectionId: selectedSection.id,
      target,
      value,
    });
  }

  function undo() {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }

  function redo() {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  }

  function handleCopilot() {
    if (!copilotInstruction.trim() || !editingConsent) return;
    setCopilotResult(null);
    startCopilot(async () => {
      const result = await runPageCopilot(projectId, {
        document,
        instruction: copilotInstruction,
        selectedSectionId: selectedSection?.id ?? null,
        scope: selectedSection ? "SELECTED" : "PAGE",
        externalEditingConsent: true,
      });
      setCopilotResult(result);
      if (result.status === "success" && result.commands.length > 0) {
        commit(applyCommands(document, result.commands));
      }
    });
  }

  function handleDesign(choice: (typeof designChoices)[number]) {
    if (!designConsent || !claudeConfigured) return;
    setDesignResult(null);
    startDesign(async () => {
      const result = await runClaudeDesignDirector(projectId, {
        document,
        preset: choice.preset,
        instruction: choice.instruction,
        externalDesignConsent: true,
      });
      setDesignResult(result);
      if (result.status === "success" && result.commands.length > 0) {
        commit(applyCommands(document, result.commands));
      }
    });
  }

  function cycleImage() {
    if (!selectedSection || editorAssets.length === 0) return;
    const currentIndex = editorAssets.findIndex(
      (asset) => asset.id === selectedSection.assetId
    );
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % editorAssets.length;
    const next = editorAssets[nextIndex];
    if (!next) return;
    runCommand({
      type: "SET_ASSET",
      sectionId: selectedSection.id,
      assetId: next.id,
    });
  }

  function generateNewMoodImage() {
    if (!selectedSection || !imageConsent) return;
    const source = editorAssets.find((asset) => asset.kind === "ORIGINAL");
    if (!source) {
      setImageResult({
        status: "error",
        message: "새 분위기의 이미지를 만들려면 원본 상품 사진이 한 장 필요합니다.",
      });
      return;
    }

    setImageResult(null);
    startImage(async () => {
      const result = await generateProjectImage(projectId, {
        sourceAssetId: source.id,
        preset: getRecommendedImagePreset(selectedSection),
        quality: "medium",
        direction: getImageDirection(selectedSection),
        externalImageConsent: true,
      });
      setImageResult(result);
      if (result.status === "success" && result.asset) {
        setEditorAssets((current) =>
          current.some((asset) => asset.id === result.asset?.id)
            ? current
            : [...current, result.asset!]
        );
        setEditorAssetUrls((current) => ({
          ...current,
          [result.asset!.id]: result.asset!.url,
        }));
        runCommand({
          type: "SET_ASSET",
          sectionId: selectedSection.id,
          assetId: result.asset.id,
        });
      }
    });
  }

  if (advanced) {
    return (
      <EditorClient
        projectId={projectId}
        productName={productName}
        initialDocument={document}
        assetUrls={editorAssetUrls}
        assets={editorAssets}
        claudeConfigured={claudeConfigured}
      />
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold text-violet-600">DETAIL AI</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-sm font-bold text-neutral-900">
                {productName}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  dirty
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
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
              disabled={history.past.length === 0 || busy}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 disabled:opacity-30"
            >
              실행 취소
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={history.future.length === 0 || busy}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 disabled:opacity-30"
            >
              다시 실행
            </button>
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-50"
            >
              고급 편집
            </button>
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
                disabled={!dirty || busy}
                className="rounded-xl bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:bg-neutral-300"
              >
                {savePending ? "저장 중..." : "저장"}
              </button>
            </form>
            <Link
              href="/dashboard"
              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
            >
              완료
            </Link>
          </div>

          {saveState.message && (
            <p
              className={`w-full text-right text-[11px] font-semibold ${
                saveState.status === "error"
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {saveState.status === "error" &&
              /pagedocument|json|schema/i.test(saveState.message)
                ? "편집 내용을 저장하지 못했습니다. 다시 시도해주세요."
                : saveState.message}
            </p>
          )}
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="border-b border-neutral-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold text-neutral-400">페이지 순서</p>
          <nav className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {document.sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
                  selectedSection?.id === section.id
                    ? "bg-violet-50 text-violet-700"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <span className="mr-2 text-neutral-400">{index + 1}</span>
                {sectionLabels[section.type]}
              </button>
            ))}
          </nav>
          <p className="mt-4 text-[11px] leading-5 text-neutral-400">
            편집할 영역을 선택하면 오른쪽에서 내용, 디자인, 이미지를 바꿀 수 있어요.
          </p>
        </aside>

        <div className="min-w-0 overflow-auto p-3 sm:p-6">
          <div className="mx-auto max-w-[1080px] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200">
            <PageRenderer
              document={document}
              assetUrls={editorAssetUrls}
              selectedSectionId={selectedSection?.id}
              onSectionSelect={setSelectedSectionId}
            />
          </div>
        </div>

        <aside className="border-t border-neutral-200 bg-white p-4 lg:border-l lg:border-t-0 lg:p-5">
          <div className="sticky top-24 max-h-[calc(100vh-120px)] overflow-auto pr-1">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1">
              {(
                [
                  ["content", "내용 수정"],
                  ["design", "디자인 변경"],
                  ["image", "이미지 변경"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPanel(key)}
                  className={`rounded-lg px-2 py-2.5 text-[11px] font-bold ${
                    panel === key
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {!selectedSection ? (
              <p className="mt-5 text-sm text-neutral-500">
                왼쪽에서 편집할 영역을 선택해주세요.
              </p>
            ) : panel === "content" ? (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs font-bold text-violet-600">
                    {sectionLabels[selectedSection.type]}
                  </p>
                  <h2 className="mt-1 text-base font-bold text-neutral-950">
                    문구를 바로 수정하세요
                  </h2>
                </div>

                <div className="space-y-4">
                  {selectedSection.eyebrow && (
                    <Field
                      label="작은 제목"
                      value={selectedSection.eyebrow}
                      onChange={(value) =>
                        updateField({ kind: "section", field: "eyebrow" }, value)
                      }
                    />
                  )}
                  <Field
                    label="메인 문구"
                    value={selectedSection.headline}
                    onChange={(value) =>
                      updateField({ kind: "section", field: "headline" }, value)
                    }
                  />
                  {selectedSection.body && (
                    <Field
                      label="설명"
                      value={selectedSection.body}
                      multiline
                      onChange={(value) =>
                        updateField({ kind: "section", field: "body" }, value)
                      }
                    />
                  )}
                  {selectedSection.ctaLabel && (
                    <Field
                      label="버튼 문구"
                      value={selectedSection.ctaLabel}
                      onChange={(value) =>
                        updateField({ kind: "section", field: "ctaLabel" }, value)
                      }
                    />
                  )}

                  {selectedSection.items.map((item, index) => (
                    <div key={`${selectedSection.id}-item-${index}`} className="rounded-2xl bg-neutral-50 p-4">
                      <Field
                        label={`항목 ${index + 1} 제목`}
                        value={item.title}
                        onChange={(value) =>
                          updateField(
                            { kind: "item", index, field: "title" },
                            value
                          )
                        }
                      />
                      <div className="mt-3">
                        <Field
                          label="설명"
                          value={item.description}
                          multiline
                          onChange={(value) =>
                            updateField(
                              { kind: "item", index, field: "description" },
                              value
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}

                  {selectedSection.faqs.map((faq, index) => (
                    <div key={`${selectedSection.id}-faq-${index}`} className="rounded-2xl bg-neutral-50 p-4">
                      <Field
                        label={`질문 ${index + 1}`}
                        value={faq.question}
                        onChange={(value) =>
                          updateField(
                            { kind: "faq", index, field: "question" },
                            value
                          )
                        }
                      />
                      <div className="mt-3">
                        <Field
                          label="답변"
                          value={faq.answer}
                          multiline
                          onChange={(value) =>
                            updateField(
                              { kind: "faq", index, field: "answer" },
                              value
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-neutral-200 pt-5">
                  <p className="text-xs font-bold text-neutral-700">AI에게 부탁하기</p>
                  <textarea
                    value={copilotInstruction}
                    onChange={(event) => setCopilotInstruction(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="예: 제목을 더 짧고 강하게 바꿔줘"
                    className="mt-2 w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-neutral-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                  <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-neutral-500">
                    <input
                      type="checkbox"
                      checked={editingConsent}
                      onChange={(event) => setEditingConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-violet-600"
                    />
                    선택한 영역의 문구를 AI가 수정하도록 전송하는 데 동의합니다.
                  </label>
                  <button
                    type="button"
                    onClick={handleCopilot}
                    disabled={busy || !editingConsent || !copilotInstruction.trim()}
                    className="mt-3 w-full rounded-xl bg-neutral-950 px-4 py-3 text-xs font-bold text-white disabled:bg-neutral-300"
                  >
                    {copilotPending ? "수정하는 중..." : "AI로 문구 수정"}
                  </button>
                  {friendlyResultMessage(copilotResult) && (
                    <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${copilotResult?.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {friendlyResultMessage(copilotResult)}
                    </p>
                  )}
                </div>
              </div>
            ) : panel === "design" ? (
              <div className="mt-5">
                <h2 className="text-base font-bold text-neutral-950">
                  어떤 느낌으로 바꿀까요?
                </h2>
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  복잡한 설정 없이 원하는 인상만 선택하세요. 전체 페이지의 여백과 배치가 함께 조정됩니다.
                </p>
                <div className="mt-4 grid gap-2">
                  {designChoices.map((choice) => (
                    <button
                      key={choice.key}
                      type="button"
                      onClick={() => handleDesign(choice)}
                      disabled={busy || !designConsent || !claudeConfigured}
                      className="rounded-2xl border border-neutral-200 px-4 py-3.5 text-left transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-40"
                    >
                      <span className="text-sm font-bold text-neutral-900">
                        {choice.label}
                      </span>
                      <span className="mt-1 block text-xs text-neutral-500">
                        {choice.description}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-neutral-500">
                  <input
                    type="checkbox"
                    checked={designConsent}
                    onChange={(event) => setDesignConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-violet-600"
                  />
                  페이지의 디자인 구성을 AI가 조정하도록 전송하는 데 동의합니다.
                </label>
                {!claudeConfigured && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    현재 자동 디자인 변경을 사용할 수 없습니다.
                  </p>
                )}
                {friendlyResultMessage(designResult) && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${designResult?.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {friendlyResultMessage(designResult)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-5">
                <h2 className="text-base font-bold text-neutral-950">이미지 바꾸기</h2>
                {!isImageSection(selectedSection) ? (
                  <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-4 text-xs leading-5 text-neutral-500">
                    이 영역은 이미지 교체가 필요하지 않아요. 이미지가 있는 다른 영역을 선택해주세요.
                  </p>
                ) : (
                  <>
                    {selectedSection.assetId && editorAssetUrls[selectedSection.assetId] ? (
                      <div
                        role="img"
                        aria-label="현재 선택 이미지"
                        className="mt-4 aspect-[4/3] rounded-2xl bg-neutral-100 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${editorAssetUrls[selectedSection.assetId]})`,
                        }}
                      />
                    ) : (
                      <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-2xl bg-neutral-100 text-xs text-neutral-400">
                        현재 이미지 없음
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={cycleImage}
                      disabled={busy || editorAssets.length === 0}
                      className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      이 이미지 바꾸기
                    </button>

                    <label className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-neutral-500">
                      <input
                        type="checkbox"
                        checked={imageConsent}
                        onChange={(event) => setImageConsent(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-violet-600"
                      />
                      원본 상품 사진을 바탕으로 새 연출 이미지를 만들도록 AI에 전송하는 데 동의합니다.
                    </label>
                    <button
                      type="button"
                      onClick={generateNewMoodImage}
                      disabled={busy || !imageConsent}
                      className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:bg-neutral-300"
                    >
                      {imagePending ? "새 이미지를 만드는 중..." : "다른 분위기로 만들기"}
                    </button>
                    <p className="mt-2 text-[11px] leading-4 text-neutral-400">
                      현재 영역에 어울리는 이미지 유형을 자동으로 선택합니다.
                    </p>
                    {friendlyResultMessage(imageResult) && (
                      <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${imageResult?.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {friendlyResultMessage(imageResult)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
