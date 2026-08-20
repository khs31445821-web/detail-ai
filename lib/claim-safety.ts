export type GroundingFact = {
  key: string;
  name: string;
  value: string;
};

const claimRules: Array<{
  label: string;
  claimTerms: string[];
  evidenceTerms: string[];
}> = [
  {
    label: "보온·보냉 성능",
    claimTerms: ["보온", "보냉", "온도 유지"],
    evidenceTerms: ["보온", "보냉", "insulation"],
  },
  {
    label: "내구·충격 성능",
    claimTerms: [
      "내구",
      "튼튼",
      "견고",
      "충격",
      "변형",
      "오래 사용",
      "오래 입",
      "오래 쓰",
    ],
    evidenceTerms: ["내구", "충격", "durability"],
  },
  {
    label: "휴대·무게",
    claimTerms: ["휴대", "가벼", "가볍", "경량"],
    evidenceTerms: ["무게", "중량", "weight", "휴대"],
  },
  {
    label: "방수·방풍 성능",
    claimTerms: ["방수", "발수", "생활 방수", "방풍", "바람을 막"],
    evidenceTerms: ["방수", "발수", "방풍", "water resistant", "windproof"],
  },
  {
    label: "통기·흡습·속건 성능",
    claimTerms: ["통기", "흡습", "속건", "땀 배출", "빠르게 마르"],
    evidenceTerms: ["통기", "흡습", "속건", "breathable", "quick dry"],
  },
  {
    label: "신축·착용감",
    claimTerms: [
      "신축",
      "스트레치",
      "편안한 착용감",
      "부드러운 촉감",
      "까슬거리지 않",
    ],
    evidenceTerms: ["신축", "스트레치", "착용감", "촉감", "stretch"],
  },
  {
    label: "착용 구조·레이어링",
    claimTerms: [
      "몸에 붙지 않",
      "타이트하게 조이지 않",
      "어깨와 팔 라인",
      "겹쳐 입",
      "레이어드",
    ],
    evidenceTerms: [
      "착용 사진",
      "착용 테스트",
      "레이어링",
      "어깨 실측",
      "가슴 실측",
      "소매 실측",
    ],
  },
  {
    label: "체형 보정 효과",
    claimTerms: [
      "체형 보정",
      "슬림해 보",
      "날씬해 보",
      "다리가 길어 보",
      "군살을 가",
    ],
    evidenceTerms: ["체형 보정", "착용 테스트", "소비자 평가"],
  },
  {
    label: "의류 세탁·관리",
    claimTerms: ["세탁기 사용", "기계 세탁", "손세탁", "드라이클리닝"],
    evidenceTerms: ["세탁", "관리법", "care_instructions", "care label"],
  },
  {
    label: "밀폐·누수 방지",
    claimTerms: ["밀폐", "누수", "새지 않", "흘림 방지"],
    evidenceTerms: ["밀폐", "누수", "leak"],
  },
  {
    label: "세척 기능",
    claimTerms: ["식기세척", "세척기", "간편 세척", "세척이 쉽"],
    evidenceTerms: ["식기세척", "dishwasher", "세척"],
  },
  {
    label: "안전·위생·인증",
    claimTerms: [
      "안전한",
      "안심",
      "위생",
      "녹슬",
      "부식",
      "냄새가 배지",
      "인증",
      "무독성",
      "bpa free",
      "bpa-free",
    ],
    evidenceTerms: ["안전", "위생", "부식", "인증", "bpa", "certificate"],
  },
  {
    label: "친환경",
    claimTerms: ["친환경", "지속 가능", "환경을 생각"],
    evidenceTerms: ["친환경", "환경", "eco"],
  },
  {
    label: "제조국·원산지",
    claimTerms: ["국내산", "국산", "한국산", "원산지", "제조국"],
    evidenceTerms: ["원산지", "제조국", "country"],
  },
  {
    label: "구성품·세트",
    claimTerms: ["선물세트", "세트 구성", "구성품"],
    evidenceTerms: ["세트", "구성품", "package"],
  },
  {
    label: "손잡이",
    claimTerms: ["손잡이", "핸들"],
    evidenceTerms: ["손잡이", "handle"],
  },
  {
    label: "미확정 단위",
    claimTerms: [
      "ml",
      "㎖",
      "밀리리터",
      "리터",
      "kg",
      "킬로그램",
      "cm",
      "센티미터",
      "mm",
      "밀리미터",
    ],
    evidenceTerms: [
      "ml",
      "㎖",
      "밀리리터",
      "리터",
      "kg",
      "킬로그램",
      "cm",
      "센티미터",
      "mm",
      "밀리미터",
    ],
  },
  {
    label: "마감 품질",
    claimTerms: ["마감", "표면 품질"],
    evidenceTerms: ["마감", "표면 품질", "finish"],
  },
  {
    label: "절대적 우월 표현",
    claimTerms: ["최고", "완벽", "최적화", "업계 1위", "유일한"],
    evidenceTerms: ["업계 1위", "최고", "인증"],
  },
  {
    label: "근거 없는 비교·평가 표현",
    claimTerms: [
      "가성비",
      "부담 없",
      "넉넉",
      "충분한",
      "적당한",
      "적절한",
      "알맞은",
      "여유로운",
      "대용량",
      "소용량",
      "실용적",
      "효율적",
      "편리한",
    ],
    evidenceTerms: ["가성비", "가격 경쟁력", "사용성 평가", "소비자 평가"],
  },
];

export function findUnsupportedClaimTerms(
  texts: string[],
  facts: GroundingFact[]
) {
  const content = texts.join("\n").toLocaleLowerCase("ko-KR");
  const evidence = facts
    .map((fact) => `${fact.key} ${fact.name} ${fact.value}`)
    .join("\n")
    .toLocaleLowerCase("ko-KR");

  return claimRules
    .filter(
      (rule) =>
        rule.claimTerms.some((term) =>
          content.includes(term.toLocaleLowerCase("ko-KR"))
        ) &&
        !rule.evidenceTerms.some((term) =>
          evidence.includes(term.toLocaleLowerCase("ko-KR"))
        )
    )
    .map((rule) => rule.label);
}

export function getUnsupportedClaimVocabulary(facts: GroundingFact[]) {
  const evidence = facts
    .map((fact) => `${fact.key} ${fact.name} ${fact.value}`)
    .join("\n")
    .toLocaleLowerCase("ko-KR");

  return claimRules
    .filter(
      (rule) =>
        !rule.evidenceTerms.some((term) =>
          evidence.includes(term.toLocaleLowerCase("ko-KR"))
        )
    )
    .flatMap((rule) => rule.claimTerms);
}
