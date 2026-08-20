export type FashionFactBlueprint = {
  categoryKey: "FASHION" | "FASHION_TOP";
  key: string;
  displayName: string;
  valueType: "STRING" | "NUMBER" | "BOOLEAN";
  description: string;
  validationRules: Record<string, unknown>;
  importance: "REQUIRED" | "RECOMMENDED";
  askUser: boolean;
  imageRule: string;
};

const fashionFacts: FashionFactBlueprint[] = [
  {
    categoryKey: "FASHION",
    key: "color",
    displayName: "색상",
    valueType: "STRING",
    description: "상품의 대표 색상 또는 명확히 구분되는 복수 색상",
    validationRules: {},
    importance: "REQUIRED",
    askUser: true,
    imageRule:
      "조명과 보정의 영향을 고려해 대표 색상만 간결하게 기록하고, 애매하면 후보로 만들지 않는다.",
  },
  {
    categoryKey: "FASHION",
    key: "pattern",
    displayName: "패턴",
    valueType: "STRING",
    description: "무지, 스트라이프, 체크, 플로럴, 도트, 그래픽, 컬러 블록 등",
    validationRules: {
      enum: [
        "무지",
        "스트라이프",
        "체크",
        "플로럴",
        "도트",
        "그래픽",
        "컬러 블록",
        "기타",
      ],
    },
    importance: "RECOMMENDED",
    askUser: false,
    imageRule: "원단 표면에 반복되거나 인쇄된 패턴이 직접 보일 때만 기록한다.",
  },
  {
    categoryKey: "FASHION",
    key: "fit",
    displayName: "핏",
    valueType: "STRING",
    description: "슬림, 레귤러, 릴랙스, 오버사이즈 등 착용 핏",
    validationRules: {
      enum: ["슬림", "레귤러", "릴랙스", "오버사이즈", "기타"],
    },
    importance: "RECOMMENDED",
    askUser: true,
    imageRule:
      "착용 사진 또는 핏을 명시한 라벨이 있을 때만 기록한다. 옷걸이·바닥 촬영만으로는 단정하지 않는다.",
  },
  {
    categoryKey: "FASHION",
    key: "material",
    displayName: "소재",
    valueType: "STRING",
    description: "판매자가 확인한 주요 소재명",
    validationRules: {},
    importance: "REQUIRED",
    askUser: true,
    imageRule:
      "케어 라벨이나 상품 표기에서 소재명이 읽힐 때만 기록한다. 표면 질감만으로 면·울·가죽 등을 추정하지 않는다.",
  },
  {
    categoryKey: "FASHION",
    key: "material_composition",
    displayName: "소재 혼용률",
    valueType: "STRING",
    description: "케어 라벨에 표시된 섬유별 정확한 혼용 비율",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: true,
    imageRule:
      "케어 라벨에서 섬유명과 비율을 함께 읽을 수 있을 때만 원문대로 기록한다.",
  },
  {
    categoryKey: "FASHION",
    key: "size_options",
    displayName: "판매 사이즈",
    valueType: "STRING",
    description: "실제로 판매하는 사이즈 선택지",
    validationRules: {},
    importance: "REQUIRED",
    askUser: true,
    imageRule:
      "사이즈 라벨이나 사이즈표에 명확히 표시된 선택지만 기록한다. 사진 속 모델 체형으로 추정하지 않는다.",
  },
  {
    categoryKey: "FASHION",
    key: "measurements",
    displayName: "실측 사이즈",
    valueType: "STRING",
    description:
      "사이즈별 실측 정보와 단위. 상의·아우터는 어깨, 가슴, 소매, 총장 등을, 하의는 허리, 엉덩이, 허벅지, 밑위, 인심, 밑단 등을 기록. 예: S: 어깨 52cm / 가슴 59.5cm / 소매 61cm / 총장 74cm | M: ...",
    validationRules: {},
    importance: "REQUIRED",
    askUser: true,
    imageRule:
      "치수표 또는 측정 이미지에서 항목·수치·단위를 함께 읽을 수 있을 때만 기록한다.",
  },
  {
    categoryKey: "FASHION",
    key: "care_instructions",
    displayName: "세탁·관리법",
    valueType: "STRING",
    description: "케어 라벨 또는 제조사가 제공한 세탁 및 관리 방법",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: true,
    imageRule:
      "케어 라벨의 문구나 기호를 명확히 읽을 수 있을 때만 기록한다. 소재만으로 세탁법을 만들지 않는다.",
  },
  {
    categoryKey: "FASHION",
    key: "country_of_origin",
    displayName: "제조국",
    valueType: "STRING",
    description: "라벨 또는 판매자가 확인한 제조국",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: true,
    imageRule: "라벨에 제조국이 명시되어 읽을 수 있을 때만 기록한다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "garment_type",
    displayName: "의류 종류",
    valueType: "STRING",
    description: "재킷, 코트, 셔츠, 블라우스, 니트, 후디, 티셔츠, 베스트 등",
    validationRules: {},
    importance: "REQUIRED",
    askUser: true,
    imageRule:
      "상품 본체의 전체 구조가 충분히 보이면 반드시 후보로 기록한다. 세부 종류가 애매하면 상의, 재킷처럼 더 일반적이고 안전한 명칭을 사용한다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "silhouette",
    displayName: "실루엣",
    valueType: "STRING",
    description: "직선형, A라인, 크롭, 박시 등 눈에 보이는 전체 형태",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "상품의 전체 윤곽이 보일 때 형태만 기록한다. 착용감이나 체형 보정 효과로 확대 해석하지 않는다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "length_type",
    displayName: "기장 형태",
    valueType: "STRING",
    description: "크롭, 허리선, 힙선, 허벅지 등 상대적인 의류 길이",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "전신 착용 사진이나 전체 상품과 기준점이 함께 보일 때만 상대적 기장을 기록하고 수치는 추정하지 않는다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "sleeve_length",
    displayName: "소매 길이",
    valueType: "STRING",
    description: "민소매, 반소매, 7부, 긴소매 등",
    validationRules: {
      enum: ["민소매", "반소매", "5부", "7부", "긴소매", "기타"],
    },
    importance: "RECOMMENDED",
    askUser: false,
    imageRule: "양쪽 소매 또는 한쪽 소매의 전체 길이가 명확히 보일 때 기록한다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "collar_type",
    displayName: "칼라 형태",
    valueType: "STRING",
    description: "셔츠 칼라, 테일러드 칼라, 스탠드 칼라, 후드, 칼라 없음 등",
    validationRules: {
      enum: [
        "셔츠 칼라",
        "테일러드 칼라",
        "스탠드 칼라",
        "세일러 칼라",
        "후드",
        "칼라 없음",
        "기타",
      ],
    },
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "목 둘레와 칼라 구조가 직접 보일 때만 허용 목록의 값으로 기록한다. 접히는 깃 없이 목을 세로로 감싸는 밴드형은 '스탠드 칼라'이며 폴로 칼라라고 부르지 않는다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "neckline",
    displayName: "넥라인",
    valueType: "STRING",
    description: "라운드넥, 브이넥, 스퀘어넥, 터틀넥 등",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "칼라가 없는 상의이거나 실제 넥라인 형태가 분명히 보일 때만 기록한다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "closure_type",
    displayName: "여밈 방식",
    valueType: "STRING",
    description: "지퍼, 단추, 스냅, 후크, 풀오버 또는 복합 여밈",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "실제로 보이는 여밈 장치를 기록한다. 플라켓 아래처럼 주 여밈이 가려졌거나 일부 장치 하나만 보이면 전체 여밈 방식을 추정하지 않고 누락한다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "pocket_count",
    displayName: "보이는 포켓 수",
    valueType: "NUMBER",
    description: "제공된 이미지에서 직접 확인되는 외부 포켓의 수",
    validationRules: { minimum: 0, maximum: 20 },
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "포켓 입구나 덮개가 분명한 외부 포켓만 세고, 가려진 면의 포켓은 포함하지 않는다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "pocket_type",
    displayName: "포켓 형태",
    valueType: "STRING",
    description: "플랩, 패치, 웰트, 지퍼 포켓 등 보이는 포켓 구조",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: false,
    imageRule: "포켓 입구와 봉제 구조가 충분히 보이는 형태만 기록한다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "adjustable_detail",
    displayName: "조절 디테일",
    valueType: "STRING",
    description: "허리·밑단·소매·후드의 스트링, 벨트, 탭, 버튼 조절 구조",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: false,
    imageRule:
      "조절 부위와 방식이 보일 때 위치와 장치를 함께 기록한다. 단순 장식을 기능으로 해석하지 않는다.",
  },
  {
    categoryKey: "FASHION_TOP",
    key: "lining",
    displayName: "안감",
    valueType: "BOOLEAN",
    description: "의류 내부에 별도 안감이 있는지 여부",
    validationRules: {},
    importance: "RECOMMENDED",
    askUser: true,
    imageRule:
      "의류 내부가 충분히 펼쳐져 안감 유무가 직접 확인될 때만 true 또는 false를 기록한다.",
  },
];

export function getFashionFactBlueprints(categoryLineageKeys: string[]) {
  const categoryKeys = new Set(categoryLineageKeys);
  if (!categoryKeys.has("FASHION")) {
    return [];
  }

  return fashionFacts.filter((fact) => categoryKeys.has(fact.categoryKey));
}

export function buildFashionImagePromptGuidance(
  categoryLineageKeys: string[]
) {
  const facts = getFashionFactBlueprints(categoryLineageKeys);
  if (facts.length === 0) {
    return [];
  }

  return [
    "[의류 전용 판정 규칙]",
    "먼저 주된 판매 상품인 의류 한 벌만 식별하고, 모델의 다른 옷·가방·액세서리·배경 소품은 제외하세요.",
    "여러 이미지가 아니라 현재 한 장의 시야만 근거로 삼고, 앞면·뒷면·내부처럼 보이지 않는 면은 추정하지 마세요.",
    "상품 전체 형태가 충분히 보이고 isProductRelevant가 true라면 garment_type은 반드시 후보로 넣되, 확실한 수준보다 세부 종류를 과도하게 특정하지 마세요.",
    "색상·패턴·소매 길이·칼라·포켓·조절 디테일을 하나씩 점검하고, 직접 확인되는 항목은 candidateFacts에 누락하지 마세요.",
    "상품 설명은 이미지 대상을 찾는 참고 정보일 뿐 Fact 근거가 아닙니다. 후보 evidence에는 이미지에서 보이는 위치와 형태를 구체적으로 쓰세요.",
    "색상 값은 '연한 베이지·회색 톤'처럼 사람이 읽기 쉬운 한국어 띄어쓰기를 사용하고, 불확실한 색상 여러 개를 붙여 새 색상명처럼 만들지 마세요.",
    "색상은 조명·화이트밸런스 영향을 고려하고, 소재·혼용률·세탁법·제조국은 라벨 문구가 읽힐 때만 후보로 만드세요.",
    "핏과 기장은 착용 모습 또는 명시된 표기 없이 옷걸이·바닥 촬영만 보고 단정하지 마세요.",
    "포켓 수는 현재 이미지에서 입구나 플랩이 확인되는 외부 포켓만 세고, 보이지 않는 반대편이나 내부 포켓을 더하지 마세요.",
    "여밈은 지퍼·단추·스냅 등 실제 장치가 보이는 범위만 기록하고, 가려진 구조는 누락하세요.",
    `Fact별 세부 관찰 기준: ${JSON.stringify(
      facts.map((fact) => ({ key: fact.key, rule: fact.imageRule }))
    )}`,
  ];
}
