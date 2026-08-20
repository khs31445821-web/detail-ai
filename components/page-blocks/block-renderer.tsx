import type { CSSProperties, ReactNode } from "react";

import { GarmentMeasurementDiagram } from "@/components/garment-measurement-diagram";
import type {
  BlockVariant,
  PageDocument,
  PageSection,
} from "@/lib/page-document";
import {
  measurementTemplates,
  parseMeasurementFact,
} from "@/lib/product-measurements";

type BlockProps = {
  section: PageSection;
  imageUrl: string | null;
  accentClass: string;
  sectionIndex: number;
};

type PageThemeStyle = CSSProperties & {
  "--page-brand": string;
  "--page-accent": string;
  "--page-accent-deep": string;
  "--page-accent-soft": string;
  "--page-accent-faint": string;
  "--page-paper": string;
  "--page-radius": string;
  "--page-radius-small": string;
};

const themePalette: Record<
  PageDocument["theme"]["primaryColor"],
  PageThemeStyle
> = {
  INK: {
    "--page-brand": "#4a4a45",
    "--page-accent": "#4a4a45",
    "--page-accent-deep": "#1d1d1b",
    "--page-accent-soft": "#ecebe6",
    "--page-accent-faint": "#f5f4f0",
    "--page-paper": "#f7f6f2",
    "--page-radius": "2rem",
    "--page-radius-small": "1rem",
  },
  VIOLET: {
    "--page-brand": "#6d6577",
    "--page-accent": "#6d6577",
    "--page-accent-deep": "#28242d",
    "--page-accent-soft": "#eeebf0",
    "--page-accent-faint": "#f6f4f6",
    "--page-paper": "#f8f6f7",
    "--page-radius": "2rem",
    "--page-radius-small": "1rem",
  },
  FOREST: {
    "--page-brand": "#657064",
    "--page-accent": "#657064",
    "--page-accent-deep": "#242a24",
    "--page-accent-soft": "#ecefe9",
    "--page-accent-faint": "#f4f5f1",
    "--page-paper": "#f7f5ef",
    "--page-radius": "2rem",
    "--page-radius-small": "1rem",
  },
  NAVY: {
    "--page-brand": "#5d6975",
    "--page-accent": "#5d6975",
    "--page-accent-deep": "#242a30",
    "--page-accent-soft": "#ebedef",
    "--page-accent-faint": "#f3f4f5",
    "--page-paper": "#f6f6f4",
    "--page-radius": "2rem",
    "--page-radius-small": "1rem",
  },
  TERRACOTTA: {
    "--page-brand": "#8b6b5f",
    "--page-accent": "#8b6b5f",
    "--page-accent-deep": "#302723",
    "--page-accent-soft": "#f0ebe8",
    "--page-accent-faint": "#f7f3f1",
    "--page-paper": "#f8f5f1",
    "--page-radius": "2rem",
    "--page-radius-small": "1rem",
  },
};

const radiusTokens: Record<
  PageDocument["theme"]["radius"],
  Pick<PageThemeStyle, "--page-radius" | "--page-radius-small">
> = {
  SOFT: {
    "--page-radius": "0.75rem",
    "--page-radius-small": "0.375rem",
  },
  ROUND: {
    "--page-radius": "1.5rem",
    "--page-radius-small": "0.75rem",
  },
  SHARP: {
    "--page-radius": "0.25rem",
    "--page-radius-small": "0.15rem",
  },
};

const moodTokens: Record<
  PageDocument["theme"]["mood"],
  Pick<PageThemeStyle, "--page-paper">
> = {
  MODERN: { "--page-paper": "#f5f5f3" },
  WARM: { "--page-paper": "#f7f3eb" },
  MINIMAL: { "--page-paper": "#ffffff" },
  PREMIUM: { "--page-paper": "#f3f0e9" },
  PLAYFUL: { "--page-paper": "#f8f3ef" },
};

function normalizeBrandColor(value: string | null) {
  if (!value || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
    return null;
  }
  return value.toUpperCase();
}

function mixHexColor(source: string, target: string, targetRatio: number) {
  const sourceValue = Number.parseInt(source.slice(1), 16);
  const targetValue = Number.parseInt(target.slice(1), 16);
  const mixed = [16, 8, 0]
    .map((shift) => {
      const sourceChannel = (sourceValue >> shift) & 255;
      const targetChannel = (targetValue >> shift) & 255;
      return Math.round(
        sourceChannel + (targetChannel - sourceChannel) * targetRatio
      );
    })
    .reduce((value, channel) => (value << 8) + channel, 0);

  return `#${mixed.toString(16).padStart(6, "0")}`;
}

function getCustomThemePalette(brandColor: string): PageThemeStyle {
  const red = Number.parseInt(brandColor.slice(1, 3), 16);
  const green = Number.parseInt(brandColor.slice(3, 5), 16);
  const blue = Number.parseInt(brandColor.slice(5, 7), 16);
  const perceivedBrightness = (red * 299 + green * 587 + blue * 114) / 1000;
  const readableAccent =
    perceivedBrightness > 170
      ? mixHexColor(brandColor, "#111111", 0.42)
      : brandColor;

  return {
    "--page-brand": brandColor,
    "--page-accent": readableAccent,
    "--page-accent-deep": mixHexColor(brandColor, "#11110f", 0.72),
    "--page-accent-soft": mixHexColor(brandColor, "#ffffff", 0.84),
    "--page-accent-faint": mixHexColor(brandColor, "#ffffff", 0.94),
    "--page-paper": "#f7f6f2",
    "--page-radius": "0.75rem",
    "--page-radius-small": "0.375rem",
  };
}

function sectionSurface(tone: PageSection["tone"]) {
  if (tone === "DARK") {
    return "bg-neutral-950 text-white";
  }

  if (tone === "ACCENT") {
    return "bg-[var(--page-accent-soft)] text-neutral-950";
  }

  if (tone === "SOFT") {
    return "bg-[var(--page-accent-soft)] text-neutral-950";
  }

  return "bg-[var(--page-paper)] text-neutral-950";
}

function SectionImage({
  imageUrl,
  className,
  fit = "cover",
}: {
  imageUrl: string | null;
  className: string;
  fit?: "cover" | "contain";
}) {
  const style: CSSProperties | undefined = imageUrl
    ? { backgroundImage: `url("${imageUrl}")` }
    : undefined;

  return (
    <div
      role={imageUrl ? "img" : undefined}
      aria-label={imageUrl ? "상품 이미지" : undefined}
      style={style}
      className={`${className} bg-neutral-100 bg-center bg-no-repeat ${
        fit === "contain" ? "bg-contain" : "bg-cover"
      }`}
    >
      {!imageUrl && (
        <div className="flex h-full min-h-48 items-center justify-center text-xs font-semibold text-neutral-400">
          상품 이미지 영역
        </div>
      )}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">
      {children}
    </p>
  );
}

type PageSpec = PageSection["specs"][number];

function isMeasurementSpec(spec: PageSpec) {
  return spec.label.includes("실측");
}

function isSizeOptionSpec(spec: PageSpec) {
  return spec.label.includes("판매 사이즈") || spec.label === "사이즈";
}

function isSizingSpec(spec: PageSpec) {
  return isMeasurementSpec(spec) || isSizeOptionSpec(spec);
}

function SizeGuideSection({
  section,
  specs,
}: {
  section: PageSection;
  specs: PageSpec[];
}) {
  const sizeOptions = specs.find(isSizeOptionSpec)?.value ?? null;
  const measurements = specs.find(isMeasurementSpec)?.value ?? null;
  const table = measurements ? parseMeasurementFact(measurements) : null;
  const measurementTemplate = table?.template ?? "TOP";
  const measurementFields = measurementTemplates[measurementTemplate].fields;
  const isDedicatedBlock = section.variant === "size_01";

  return (
    <section className="bg-[#ece8df] px-7 py-28 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="grid gap-8 border-b border-neutral-400/60 pb-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <Eyebrow>{isDedicatedBlock ? section.eyebrow : "SIZE GUIDE"}</Eyebrow>
            <h2 className="mt-7 break-keep font-serif text-4xl font-normal leading-[1.1] tracking-[-0.035em] sm:text-6xl">
              {isDedicatedBlock ? section.headline : "실측 사이즈"}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-neutral-600">
            {isDedicatedBlock && section.body
              ? section.body
              : "평소 잘 맞는 의류의 같은 부위를 측정해 아래 실측값과 비교해보세요."}
          </p>
        </header>

        {sizeOptions && (
          <div className="grid gap-3 border-b border-neutral-400/60 py-7 sm:grid-cols-[180px_1fr] sm:items-center">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500">판매 사이즈</p>
            <p className="text-base font-semibold text-neutral-950">{sizeOptions}</p>
          </div>
        )}

        {table ? (
          <div className="overflow-x-auto border-b border-neutral-400/60">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-400/60 text-[11px] font-semibold tracking-[0.06em] text-neutral-500">
                  <th className="px-3 py-5 first:pl-0">사이즈</th>
                  {measurementFields.map((field) => (
                    <th key={field.key} className="px-3 py-5">{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${row.size}-${rowIndex}`} className="border-b border-neutral-400/35 last:border-0">
                    <th className="px-3 py-6 first:pl-0 text-sm font-semibold text-neutral-950">{row.size}</th>
                    {measurementFields.map((field) => (
                      <td key={`${row.size}-${field.key}`} className="px-3 py-6 text-sm text-neutral-700">
                        {row.values[field.key] ? `${row.values[field.key]}cm` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : measurements ? (
          <div className="border-b border-neutral-400/60 py-8">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500">상세 실측</p>
            <p className="mt-4 whitespace-pre-line text-sm font-medium leading-8 text-neutral-900">
              {measurements.replace(/\s*\|\s*/g, "\n")}
            </p>
          </div>
        ) : null}

        <div className="grid gap-10 pt-10 lg:grid-cols-[180px_1fr]">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500">측정 기준</p>
          <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:items-start">
            <GarmentMeasurementDiagram template={measurementTemplate} />
            <div>
              <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                {measurementFields.map((field) => (
                  <div key={field.key} className="border-t border-neutral-400/50 pt-4">
                    <dt className="text-sm font-semibold text-neutral-900">{field.label}</dt>
                    <dd className="mt-2 text-xs leading-6 text-neutral-600">{field.description}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 text-xs leading-6 text-neutral-500">
                단면 기준이며, 측정 위치와 방법 및 소재 특성에 따라 1–3cm 정도 차이가 날 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hero01({ section, imageUrl }: BlockProps) {
  const dark = section.tone === "DARK";
  const centered = section.align === "CENTER";

  return (
    <section
      className={`grid min-h-[720px] border-b border-black/10 lg:grid-cols-[0.88fr_1.12fr] ${
        dark ? "bg-[var(--page-accent-deep)] text-white" : "bg-[var(--page-paper)] text-neutral-950"
      }`}
    >
      <div className="flex items-center px-8 py-24 sm:px-14 lg:px-20">
        <div className={`${centered ? "mx-auto text-center" : ""} max-w-xl`}>
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-8 break-keep text-balance font-serif text-5xl font-normal leading-[1.06] tracking-[-0.045em] sm:text-7xl">
            {section.headline}
          </h2>
          <p
            className={`mt-8 max-w-md text-sm leading-8 sm:text-base ${centered ? "mx-auto" : ""} ${
              dark ? "text-white/65" : "text-neutral-600"
            }`}
          >
            {section.body}
          </p>
          {section.items.length > 0 && (
            <div className={`mt-9 border-y border-current/15 py-4 ${centered ? "text-center" : ""}`}>
              {section.items.slice(0, 3).map((item, index) => (
                <span
                  key={`${section.id}-hero-item-${index}`}
                  className="mr-5 inline-block py-1 text-[11px] font-medium tracking-wide opacity-70 last:mr-0"
                >
                  {item.title}
                </span>
              ))}
            </div>
          )}
          {section.ctaLabel && (
            <a
              href="#page-action"
              className={`group mt-10 inline-flex items-center border-b border-current pb-2 text-xs font-semibold tracking-[0.08em] ${
                dark ? "text-white" : "text-neutral-900"
              }`}
            >
              {section.ctaLabel}
              <span className="ml-8 transition-transform group-hover:translate-x-1">→</span>
            </a>
          )}
        </div>
      </div>
      <div className="flex min-h-[560px] items-center bg-[#e8e5de] lg:min-h-full">
        <SectionImage
          imageUrl={imageUrl}
          fit="contain"
          className="min-h-[560px] w-full lg:min-h-[720px]"
        />
      </div>
    </section>
  );
}

function Hero02({ section, imageUrl, accentClass }: BlockProps) {
  return (
    <section className="relative min-h-[760px] overflow-hidden bg-[var(--page-accent-deep)] text-white">
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,18,17,.82)_0%,rgba(18,18,17,.42)_58%,rgba(18,18,17,.08)_100%)]" />
      <div className="relative mx-auto flex min-h-[760px] max-w-6xl items-end px-8 py-20 sm:px-14 lg:px-20">
        <div className="max-w-3xl">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>
            {section.eyebrow}
          </p>
          <h2 className="mt-8 max-w-3xl break-keep text-balance font-serif text-5xl font-normal leading-[1.02] tracking-[-0.045em] sm:text-8xl">
            {section.headline}
          </h2>
          <div className="mt-9 grid gap-7 border-t border-white/30 pt-7 sm:grid-cols-[1fr_auto] sm:items-end">
            <p className="max-w-2xl text-base leading-8 text-neutral-300 sm:text-lg">
              {section.body}
            </p>
            {section.ctaLabel && (
              <a
                href="#page-action"
                className="inline-flex w-fit items-center border border-white/60 px-6 py-3.5 text-xs font-semibold tracking-[0.08em] text-white"
              >
                {section.ctaLabel}
                <span className="ml-6">→</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Hero03({ section, imageUrl }: BlockProps) {
  return (
    <section className="bg-[var(--page-paper)] px-5 pb-16 pt-8 text-neutral-950 sm:px-10 sm:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between border-y border-neutral-300 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          <span>{section.eyebrow}</span>
          <span>Product edition</span>
        </div>
        <div className="mx-auto max-w-5xl px-3 py-14 text-center sm:py-20">
          <h2 className="break-keep text-balance font-serif text-5xl font-normal leading-[0.98] tracking-[-0.055em] sm:text-8xl lg:text-9xl">
            {section.headline}
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-sm leading-8 text-neutral-600 sm:text-base">
            {section.body}
          </p>
        </div>
        <div className="bg-[var(--page-accent-soft)] p-3 sm:p-6">
          <SectionImage
            imageUrl={imageUrl}
            fit="contain"
            className="min-h-[520px] w-full bg-[#e4e1d9] sm:min-h-[760px]"
          />
        </div>
        <div className="grid gap-7 border-b border-neutral-300 py-7 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap gap-x-7 gap-y-2">
            {section.items.slice(0, 3).map((item, index) => (
              <span key={`${section.id}-hero-editorial-${index}`} className="text-[11px] font-medium text-neutral-600">
                {item.title}
              </span>
            ))}
          </div>
          {section.ctaLabel && (
            <a href="#page-action" className="inline-flex w-fit items-center bg-neutral-950 px-6 py-3 text-xs font-semibold text-white">
              {section.ctaLabel}
              <span className="ml-8">↓</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Benefit01({ section }: BlockProps) {
  const dark = section.tone === "DARK";

  return (
    <section className={`px-7 py-28 sm:px-12 ${sectionSurface(section.tone)}`}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 border-b border-current/15 pb-12 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
          <div>
            <Eyebrow>{section.eyebrow}</Eyebrow>
          </div>
          <div>
            <h2 className="break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.035em] sm:text-6xl">
              {section.headline}
            </h2>
            <p className={`mt-5 max-w-2xl text-sm leading-7 ${dark ? "text-white/60" : "text-neutral-600"}`}>
              {section.body}
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-3">
          {section.items.map((item, index) => (
            <article
              key={`${section.id}-benefit-${index}`}
              className="border-b border-current/15 py-9 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
            >
              <span className="text-[10px] font-medium tracking-[0.18em] text-[var(--page-accent)]">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-8 text-xl font-semibold leading-snug tracking-[-0.02em]">{item.title}</h3>
              <p className={`mt-4 text-sm leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefit02({ section }: BlockProps) {
  return (
    <section className="bg-[var(--page-accent-deep)] px-7 py-28 text-white sm:px-12">
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {section.eyebrow}
          </p>
          <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.035em] sm:text-6xl">
            {section.headline}
          </h2>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/65">{section.body}</p>
        </div>
        <div className="border-t border-white/25">
          {section.items.map((item, index) => (
            <article key={`${section.id}-benefit-dark-${index}`} className="border-b border-white/20 py-8">
              <div className="grid gap-4 sm:grid-cols-[64px_1fr]">
                <span className="text-[10px] font-medium tracking-[0.18em] text-white/40">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.015em]">{item.title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/55">{item.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefit03({ section }: BlockProps) {
  const dark = section.tone === "DARK";

  return (
    <section className={`px-7 py-28 sm:px-12 ${sectionSurface(section.tone)}`}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 pb-14 lg:grid-cols-[0.62fr_1.38fr]">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <div>
            <h2 className="max-w-4xl break-keep text-balance font-serif text-4xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-7xl">
              {section.headline}
            </h2>
            <p className={`mt-7 max-w-2xl text-sm leading-8 ${dark ? "text-white/60" : "text-neutral-600"}`}>
              {section.body}
            </p>
          </div>
        </div>
        <div className="border-t border-current/20">
          {section.items.map((item, index) => (
            <article
              key={`${section.id}-benefit-editorial-${index}`}
              className="grid gap-5 border-b border-current/20 py-8 sm:grid-cols-[52px_0.8fr_1.2fr] sm:items-start sm:gap-8"
            >
              <span className="text-[10px] font-medium tracking-[0.18em] text-[var(--page-accent)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-semibold leading-snug tracking-[-0.02em] sm:text-2xl">
                {item.title}
              </h3>
              <p className={`max-w-xl text-sm leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImageText01({ section, imageUrl }: BlockProps) {
  const dark = section.tone === "DARK";
  return (
    <section className={`px-7 py-28 sm:px-12 ${sectionSurface(section.tone)}`}>
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <SectionImage
          imageUrl={imageUrl}
          fit="contain"
          className="min-h-[580px] bg-[#e8e5de] lg:min-h-[680px]"
        />
        <div className="px-1 py-6 lg:pl-10">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.035em] sm:text-6xl">
            {section.headline}
          </h2>
          <p className={`mt-7 text-sm leading-8 ${dark ? "text-white/60" : "text-neutral-600"}`}>
            {section.body}
          </p>
          {section.items.length > 0 && (
            <ul className="mt-10 border-t border-current/15">
              {section.items.map((item, index) => (
                <li key={`${section.id}-image-copy-${index}`} className="grid grid-cols-[34px_1fr] gap-4 border-b border-current/15 py-5 text-sm">
                  <span className="text-[10px] font-medium tracking-widest text-[var(--page-accent)]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="leading-7"><strong className="mr-2 font-semibold">{item.title}</strong>{item.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ImageText02({ section, imageUrl }: BlockProps) {
  return (
    <section className="relative min-h-[760px] overflow-hidden bg-[#dedbd4]">
      <SectionImage
        imageUrl={imageUrl}
        className="absolute inset-0 h-full w-full bg-[#dedbd4]"
      />
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative mx-auto flex min-h-[760px] max-w-6xl items-end px-7 py-14 sm:px-12 sm:py-20">
        <div className="max-w-xl bg-[var(--page-paper)] p-8 text-neutral-950 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.45)] sm:p-12">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.04em] sm:text-6xl">
            {section.headline}
          </h2>
          <p className="mt-7 max-w-xl text-sm leading-8 text-neutral-600">
            {section.body}
          </p>
          {section.items.length > 0 && (
            <div className="mt-9 border-t border-neutral-300 pt-5">
              {section.items.map((item, index) => (
                <span key={`${section.id}-image-overlay-${index}`} className="mr-5 inline-block py-1 text-[11px] font-medium text-neutral-600 last:mr-0">
                  {item.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ImageText03({ section, imageUrl, sectionIndex }: BlockProps) {
  const dark = section.tone === "DARK";
  const imageOnRight = sectionIndex % 2 === 0;

  return (
    <section className={`px-7 py-24 sm:px-12 sm:py-32 ${sectionSurface(section.tone)}`}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12 lg:items-center lg:gap-6">
        <div className={`${imageOnRight ? "lg:order-2 lg:col-start-6" : "lg:col-start-1"} lg:col-span-7`}>
          <div className="border border-current/10 p-3">
            <SectionImage
              imageUrl={imageUrl}
              fit="contain"
              className="min-h-[560px] bg-[#e5e2da] sm:min-h-[720px]"
            />
          </div>
        </div>
        <div className={`${imageOnRight ? "lg:order-1 lg:col-start-1" : "lg:col-start-9"} lg:col-span-4`}>
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-6xl">
            {section.headline}
          </h2>
          <p className={`mt-7 text-sm leading-8 ${dark ? "text-white/60" : "text-neutral-600"}`}>
            {section.body}
          </p>
          {section.items.length > 0 && (
            <dl className="mt-10 border-t border-current/20">
              {section.items.map((item, index) => (
                <div key={`${section.id}-image-asymmetric-${index}`} className="border-b border-current/20 py-5">
                  <dt className="text-sm font-semibold">{item.title}</dt>
                  <dd className={`mt-2 text-xs leading-6 ${dark ? "text-white/50" : "text-neutral-500"}`}>
                    {item.description}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function Feature01({ section }: BlockProps) {
  const dark = section.tone === "DARK";

  return (
    <section className={`px-7 py-28 sm:px-12 ${sectionSurface(section.tone)}`}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <Eyebrow>{section.eyebrow}</Eyebrow>
          </div>
          <div>
            <h2 className="max-w-3xl break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.035em] sm:text-6xl">
              {section.headline}
            </h2>
            <p className={`mt-6 max-w-2xl text-sm leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>{section.body}</p>
          </div>
        </div>
        <div className="mt-14 grid border-t border-current/15 md:grid-cols-2">
          {section.items.map((item, index) => (
            <article
              key={`${section.id}-feature-${index}`}
              className="border-b border-current/15 py-8 md:px-8 md:odd:border-r md:odd:pl-0 md:even:pr-0"
            >
              <p className="text-[10px] font-medium tracking-[0.18em] text-[var(--page-accent)]">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-6 text-xl font-semibold leading-tight tracking-[-0.02em]">{item.title}</h3>
              <p className={`mt-3 max-w-md text-sm leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Feature02({ section, imageUrl }: BlockProps) {
  const dark = section.tone === "DARK";
  const midpoint = Math.ceil(section.items.length / 2);
  const itemGroups = [section.items.slice(0, midpoint), section.items.slice(midpoint)];

  return (
    <section className={`px-7 py-28 sm:px-12 ${sectionSurface(section.tone)}`}>
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-3xl text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-7xl">
            {section.headline}
          </h2>
          <p className={`mx-auto mt-6 max-w-xl text-sm leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>
            {section.body}
          </p>
        </header>
        <div className="mt-16 grid gap-10 lg:grid-cols-[0.72fr_1.56fr_0.72fr] lg:items-center">
          {itemGroups.map((group, groupIndex) => (
            <div key={`${section.id}-feature-group-${groupIndex}`} className={`${groupIndex === 1 ? "lg:order-3" : "lg:order-1"} border-t border-current/20`}>
              {group.map((item, index) => (
                <article key={`${section.id}-feature-focus-${groupIndex}-${index}`} className="border-b border-current/20 py-7">
                  <h3 className="text-lg font-semibold tracking-[-0.02em]">{item.title}</h3>
                  <p className={`mt-3 text-sm leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          ))}
          <div className="bg-[var(--page-accent-soft)] p-4 lg:order-2">
            <SectionImage
              imageUrl={imageUrl}
              fit="contain"
              className="min-h-[560px] bg-[#e5e2da] lg:min-h-[680px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Spec01({ section }: BlockProps) {
  const generalSpecs = section.specs.filter((spec) => !isSizingSpec(spec));
  const sizingSpecs = section.specs.filter(isSizingSpec);

  return (
    <>
      {generalSpecs.length > 0 && (
        <section className="bg-[var(--page-paper)] px-7 py-28 sm:px-12">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.72fr_1.28fr]">
            <header>
              <Eyebrow>{section.eyebrow}</Eyebrow>
              <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.035em] sm:text-6xl">{section.headline}</h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-neutral-500">{section.body}</p>
            </header>
            <dl className="border-t border-neutral-300">
              {generalSpecs.map((spec, index) => (
                <div
                  key={`${spec.factId}-${index}`}
                  className="grid gap-3 border-b border-neutral-300 py-5 sm:grid-cols-[0.7fr_1.3fr] sm:gap-6"
                >
                  <dt className="text-[11px] font-medium text-neutral-500">{spec.label}</dt>
                  <dd className="text-sm font-medium text-neutral-900">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
      {sizingSpecs.length > 0 && (
        <SizeGuideSection section={section} specs={sizingSpecs} />
      )}
    </>
  );
}

function Spec02({ section }: BlockProps) {
  const generalSpecs = section.specs.filter((spec) => !isSizingSpec(spec));
  const sizingSpecs = section.specs.filter(isSizingSpec);

  return (
    <>
      {generalSpecs.length > 0 && (
        <section className="bg-[var(--page-accent-deep)] px-7 py-28 text-white sm:px-12">
          <div className="mx-auto max-w-6xl">
            <header className="grid gap-8 border-b border-white/25 pb-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{section.eyebrow}</p>
              <div>
                <h2 className="break-keep text-balance font-serif text-4xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-7xl">
                  {section.headline}
                </h2>
                <p className="mt-6 max-w-2xl text-sm leading-7 text-white/55">{section.body}</p>
              </div>
            </header>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
              {generalSpecs.map((spec, index) => (
                <div
                  key={`${spec.factId}-${index}`}
                  className="border-b border-white/20 py-7 sm:px-7 sm:odd:border-r sm:odd:pl-0 lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(3n+1)]:pl-0"
                >
                  <dt className="text-[10px] font-medium tracking-[0.12em] text-white/40">{spec.label}</dt>
                  <dd className="mt-4 break-words font-serif text-2xl text-white/90">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
      {sizingSpecs.length > 0 && <SizeGuideSection section={section} specs={sizingSpecs} />}
    </>
  );
}

function Size01({ section }: BlockProps) {
  return <SizeGuideSection section={section} specs={section.specs} />;
}

function Faq01({ section }: BlockProps) {
  return (
    <section className="bg-[var(--page-accent-faint)] px-7 py-28 sm:px-12">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-8 break-keep text-balance font-serif text-4xl font-normal leading-[1.12] tracking-[-0.035em] sm:text-6xl">{section.headline}</h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-neutral-500">{section.body}</p>
        </div>
        <div className="border-t border-neutral-300">
          {section.faqs.map((faq, index) => (
            <details key={`${section.id}-faq-${index}`} className="group border-b border-neutral-300 py-6">
              <summary className="grid cursor-pointer list-none grid-cols-[34px_1fr_auto] items-center gap-4 text-sm font-semibold text-neutral-900">
                <span className="text-[10px] font-medium tracking-wider text-neutral-400">{String(index + 1).padStart(2, "0")}</span>
                <span>{faq.question}</span>
                <span className="text-lg font-light text-neutral-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="ml-[50px] mt-5 max-w-xl text-sm leading-7 text-neutral-500">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta01({ section }: BlockProps) {
  return (
    <section id="page-action" className="bg-[var(--page-accent-deep)] px-7 py-32 text-center text-white sm:px-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{section.eyebrow}</p>
        <h2 className="mx-auto mt-9 max-w-3xl break-keep text-balance font-serif text-5xl font-normal leading-[1.06] tracking-[-0.04em] sm:text-7xl">{section.headline}</h2>
        <p className="mx-auto mt-8 max-w-xl text-sm leading-8 text-white/55">{section.body}</p>
        <a href="#page-top" className="group mt-12 inline-flex items-center border-b border-white/60 pb-2 text-xs font-semibold tracking-[0.08em] text-white">
          {section.ctaLabel || "상품 확인하기"}
          <span className="ml-8 transition-transform group-hover:-translate-y-1">↑</span>
        </a>
      </div>
    </section>
  );
}

function Cta02({ section }: BlockProps) {
  return (
    <section id="page-action" className="bg-[var(--page-paper)] px-7 py-24 sm:px-12 sm:py-32">
      <div className="mx-auto grid max-w-6xl overflow-hidden border border-neutral-300 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="p-8 sm:p-14 lg:p-20">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <h2 className="mt-9 max-w-3xl break-keep text-balance font-serif text-5xl font-normal leading-[1.04] tracking-[-0.045em] sm:text-7xl">
            {section.headline}
          </h2>
          <p className="mt-7 max-w-xl text-sm leading-8 text-neutral-600">{section.body}</p>
        </div>
        <div className="flex min-h-[300px] flex-col justify-between bg-[var(--page-accent-deep)] p-8 text-white sm:p-12">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Final selection</span>
          <a href="#page-top" className="group border-t border-white/35 pt-7 text-xl font-semibold tracking-[-0.02em]">
            {section.ctaLabel || "상품 정보 확인하기"}
            <span className="float-right transition-transform group-hover:-translate-y-1">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}

const blockRegistry: Record<BlockVariant, (props: BlockProps) => ReactNode> = {
  hero_01: Hero01,
  hero_02: Hero02,
  hero_03: Hero03,
  benefit_01: Benefit01,
  benefit_02: Benefit02,
  benefit_03: Benefit03,
  image_text_01: ImageText01,
  image_text_02: ImageText02,
  image_text_03: ImageText03,
  feature_01: Feature01,
  feature_02: Feature02,
  spec_01: Spec01,
  spec_02: Spec02,
  size_01: Size01,
  faq_01: Faq01,
  cta_01: Cta01,
  cta_02: Cta02,
};

const accentClasses: Record<PageDocument["theme"]["primaryColor"], string> = {
  INK: "text-neutral-300",
  VIOLET: "text-violet-300",
  FOREST: "text-emerald-300",
  NAVY: "text-blue-300",
  TERRACOTTA: "text-orange-300",
};

export function BlockRenderer({
  section,
  assetUrls,
  accentClass,
  sectionIndex,
  selected = false,
  onSelect,
}: {
  section: PageSection;
  assetUrls: Record<string, string>;
  accentClass: string;
  sectionIndex: number;
  selected?: boolean;
  onSelect?: (sectionId: string) => void;
}) {
  const Component = blockRegistry[section.variant];
  return (
    <div
      id={`section-${section.id}`}
      data-block-variant={section.variant}
      data-editor-selected={selected || undefined}
      onClick={onSelect ? () => onSelect(section.id) : undefined}
      className={`relative transition ${
        onSelect ? "cursor-pointer" : ""
      } ${
        selected
          ? "z-10 ring-4 ring-inset ring-violet-500"
          : onSelect
            ? "hover:ring-2 hover:ring-inset hover:ring-violet-300"
            : ""
      }`}
    >
      <Component
        section={section}
        imageUrl={section.assetId ? assetUrls[section.assetId] ?? null : null}
        accentClass={accentClass}
        sectionIndex={sectionIndex}
      />
    </div>
  );
}

export function PageRenderer({
  document,
  assetUrls,
  selectedSectionId,
  onSectionSelect,
}: {
  document: PageDocument;
  assetUrls: Record<string, string>;
  selectedSectionId?: string;
  onSectionSelect?: (sectionId: string) => void;
}) {
  const brandColor = normalizeBrandColor(document.theme.brandColor);
  const accentClass = brandColor
    ? "text-white/75"
    : accentClasses[document.theme.primaryColor];
  const themeStyle: PageThemeStyle = {
    ...(brandColor
      ? getCustomThemePalette(brandColor)
      : themePalette[document.theme.primaryColor]),
    ...moodTokens[document.theme.mood],
    ...radiusTokens[document.theme.radius],
  };

  return (
    <div
      id="page-top"
      data-page-mood={document.theme.mood}
      data-page-radius={document.theme.radius}
      style={themeStyle}
      className="overflow-hidden bg-[var(--page-paper)] text-neutral-950"
    >
      {document.sections.map((section, index) => (
        <BlockRenderer
          key={section.id}
          section={section}
          assetUrls={assetUrls}
          accentClass={accentClass}
          sectionIndex={index}
          selected={section.id === selectedSectionId}
          onSelect={onSectionSelect}
        />
      ))}
    </div>
  );
}
