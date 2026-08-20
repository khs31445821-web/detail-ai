import type { MeasurementTemplateKey } from "@/lib/product-measurements";

export function GarmentMeasurementDiagram({
  template,
  className = "",
}: {
  template: MeasurementTemplateKey;
  className?: string;
}) {
  if (template === "BOTTOM") {
    return (
      <figure className={className}>
        <svg
          viewBox="0 0 420 420"
          role="img"
          aria-label="하의 실측 위치 안내 그림"
          className="h-auto w-full"
        >
          <rect width="420" height="420" rx="28" fill="#f7f5ef" />
          <path
            d="M125 64h170l-13 125 48 166h-76l-44-129-44 129H90l48-166z"
            fill="#dedbd2"
            stroke="#4b4a45"
            strokeWidth="2"
          />
          <path d="M125 91h170M210 64v162" fill="none" stroke="#8a8880" strokeWidth="1.5" />
          <g fill="none" stroke="#7569a8" strokeWidth="2">
            <path d="M125 79h170" />
            <path d="M112 145h196" />
            <path d="M158 218h103" />
            <path d="M210 66v160" />
            <path d="M221 226l31 126" />
            <path d="M90 355h76" />
          </g>
          <g fill="#7569a8" fontSize="13" fontWeight="700">
            <text x="178" y="69">1 허리</text>
            <text x="174" y="136">2 엉덩이</text>
            <text x="175" y="209">3 허벅지</text>
            <text x="217" y="151">4 밑위</text>
            <text x="255" y="292">5 인심</text>
            <text x="97" y="377">6 밑단</text>
          </g>
          <g fill="#7569a8">
            {[125, 295].map((x) => <circle key={`waist-${x}`} cx={x} cy="79" r="4" />)}
            {[112, 308].map((x) => <circle key={`hip-${x}`} cx={x} cy="145" r="4" />)}
            {[158, 261].map((x) => <circle key={`thigh-${x}`} cx={x} cy="218" r="4" />)}
            {[66, 226].map((y) => <circle key={`rise-${y}`} cx="210" cy={y} r="4" />)}
            <circle cx="221" cy="226" r="4" />
            <circle cx="252" cy="352" r="4" />
            {[90, 166].map((x) => <circle key={`hem-${x}`} cx={x} cy="355" r="4" />)}
          </g>
        </svg>
        <figcaption className="mt-3 text-center text-xs leading-5 text-neutral-500">
          바닥에 평평하게 놓고 단면 기준으로 측정합니다.
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={className}>
      <svg
        viewBox="0 0 420 420"
        role="img"
        aria-label="상의와 아우터 실측 위치 안내 그림"
        className="h-auto w-full"
      >
        <rect width="420" height="420" rx="28" fill="#f7f5ef" />
        <path
          d="M154 72l-54 27-53 105 57 29 24-51v174h164V182l24 51 57-29-53-105-54-27c-7 23-25 35-56 35s-49-12-56-35z"
          fill="#dedbd2"
          stroke="#4b4a45"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M210 108v248M128 181h164" fill="none" stroke="#8a8880" strokeWidth="1.5" />
        <g fill="none" stroke="#7569a8" strokeWidth="2">
          <path d="M135 111h150" />
          <path d="M128 181h164" />
          <path d="M283 107l68 112" />
          <path d="M310 91v265" />
        </g>
        <g fill="#7569a8" fontSize="13" fontWeight="700">
          <text x="185" y="100">1 어깨</text>
          <text x="171" y="171">2 가슴 단면</text>
          <text x="320" y="161">3 소매</text>
          <text x="318" y="280">4 총장</text>
        </g>
        <g fill="#7569a8">
          {[135, 285].map((x) => <circle key={`shoulder-${x}`} cx={x} cy="111" r="4" />)}
          {[128, 292].map((x) => <circle key={`chest-${x}`} cx={x} cy="181" r="4" />)}
          <circle cx="283" cy="107" r="4" />
          <circle cx="351" cy="219" r="4" />
          {[91, 356].map((y) => <circle key={`length-${y}`} cx="310" cy={y} r="4" />)}
        </g>
      </svg>
      <figcaption className="mt-3 text-center text-xs leading-5 text-neutral-500">
        단추나 지퍼를 잠근 뒤 바닥에 평평하게 놓고 측정합니다.
      </figcaption>
    </figure>
  );
}
