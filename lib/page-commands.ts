import type {
  BlockVariant,
  PageDocument,
  PageSection,
} from "@/lib/page-document";
import { getBlockType } from "@/lib/page-document";

type SectionTextField = "eyebrow" | "headline" | "body" | "ctaLabel";
type ItemTextField = "title" | "description";
type FaqTextField = "question" | "answer";

export type PageFieldTarget =
  | { kind: "section"; field: SectionTextField }
  | { kind: "item"; index: number; field: ItemTextField }
  | { kind: "faq"; index: number; field: FaqTextField };

export type PageCommand =
  | {
      type: "UPDATE_FIELD";
      sectionId: string;
      target: PageFieldTarget;
      value: string;
    }
  | {
      type: "MOVE_SECTION";
      sectionId: string;
      toIndex: number;
    }
  | {
      type: "SET_VARIANT";
      sectionId: string;
      variant: BlockVariant;
    }
  | {
      type: "SET_STYLE";
      sectionId: string;
      tone?: PageSection["tone"];
      align?: PageSection["align"];
    }
  | {
      type: "SET_ASSET";
      sectionId: string;
      assetId: string | null;
    }
  | {
      type: "CHANGE_THEME";
      patch: Partial<PageDocument["theme"]>;
    };

function replaceSection(
  document: PageDocument,
  sectionId: string,
  update: (section: PageSection) => PageSection
) {
  const sections = document.sections.map((section) =>
    section.id === sectionId ? update(section) : section
  );

  return { ...document, sections };
}

function updateField(
  section: PageSection,
  target: PageFieldTarget,
  value: string
) {
  if (target.kind === "section") {
    return { ...section, [target.field]: value };
  }

  if (target.kind === "item") {
    if (!section.items[target.index]) {
      return section;
    }

    return {
      ...section,
      items: section.items.map((item, index) =>
        index === target.index ? { ...item, [target.field]: value } : item
      ),
    };
  }

  if (!section.faqs[target.index]) {
    return section;
  }

  return {
    ...section,
    faqs: section.faqs.map((faq, index) =>
      index === target.index ? { ...faq, [target.field]: value } : faq
    ),
  };
}

function moveSection(
  document: PageDocument,
  sectionId: string,
  requestedIndex: number
) {
  const fromIndex = document.sections.findIndex(
    (section) => section.id === sectionId
  );
  if (fromIndex < 0) {
    return document;
  }

  const movingSection = document.sections[fromIndex];
  if (movingSection.type === "hero" || movingSection.type === "cta") {
    return document;
  }

  const sections = [...document.sections];
  const [removed] = sections.splice(fromIndex, 1);
  const toIndex = Math.max(1, Math.min(requestedIndex, sections.length - 1));
  sections.splice(toIndex, 0, removed);

  return { ...document, sections };
}

export function executePageCommand(
  document: PageDocument,
  command: PageCommand
): PageDocument {
  switch (command.type) {
    case "UPDATE_FIELD":
      return replaceSection(document, command.sectionId, (section) =>
        updateField(section, command.target, command.value)
      );
    case "MOVE_SECTION":
      return moveSection(document, command.sectionId, command.toIndex);
    case "SET_VARIANT":
      return replaceSection(document, command.sectionId, (section) => {
        if (getBlockType(command.variant) !== section.type) {
          return section;
        }

        return { ...section, variant: command.variant };
      });
    case "SET_STYLE":
      return replaceSection(document, command.sectionId, (section) => ({
        ...section,
        tone: command.tone ?? section.tone,
        align: command.align ?? section.align,
      }));
    case "SET_ASSET":
      return replaceSection(document, command.sectionId, (section) => ({
        ...section,
        assetId: command.assetId,
      }));
    case "CHANGE_THEME":
      return {
        ...document,
        theme: { ...document.theme, ...command.patch },
      };
  }
}
