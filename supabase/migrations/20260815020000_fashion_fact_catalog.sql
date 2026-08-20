begin;

-- 기존 전역 Fact key는 재사용하고, 없는 패션 Fact만 추가한다.
insert into public.fact_definitions (
  key, display_name, value_type, description, validation_rules
)
select seed.key, seed.display_name, seed.value_type, seed.description, seed.validation_rules
from (
  values
    ('color', '색상', 'STRING', '상품의 대표 색상 또는 명확히 구분되는 복수 색상', '{}'::jsonb),
    ('pattern', '패턴', 'STRING', '무지, 스트라이프, 체크, 플로럴, 도트, 그래픽, 컬러 블록 등', '{"enum":["무지","스트라이프","체크","플로럴","도트","그래픽","컬러 블록","기타"]}'::jsonb),
    ('fit', '핏', 'STRING', '슬림, 레귤러, 릴랙스, 오버사이즈 등 착용 핏', '{"enum":["슬림","레귤러","릴랙스","오버사이즈","기타"]}'::jsonb),
    ('material', '소재', 'STRING', '판매자가 확인한 주요 소재명', '{}'::jsonb),
    ('material_composition', '소재 혼용률', 'STRING', '케어 라벨에 표시된 섬유별 정확한 혼용 비율', '{}'::jsonb),
    ('size_options', '판매 사이즈', 'STRING', '실제로 판매하는 사이즈 선택지', '{}'::jsonb),
    ('measurements', '실측 사이즈', 'STRING', '사이즈별 어깨, 가슴, 소매, 총장 등의 실측 정보와 단위', '{}'::jsonb),
    ('care_instructions', '세탁·관리법', 'STRING', '케어 라벨 또는 제조사가 제공한 세탁 및 관리 방법', '{}'::jsonb),
    ('country_of_origin', '제조국', 'STRING', '라벨 또는 판매자가 확인한 제조국', '{}'::jsonb),
    ('garment_type', '의류 종류', 'STRING', '재킷, 코트, 셔츠, 블라우스, 니트, 후디, 티셔츠, 베스트 등', '{}'::jsonb),
    ('silhouette', '실루엣', 'STRING', '직선형, A라인, 크롭, 박시 등 눈에 보이는 전체 형태', '{}'::jsonb),
    ('length_type', '기장 형태', 'STRING', '크롭, 허리선, 힙선, 허벅지 등 상대적인 의류 길이', '{}'::jsonb),
    ('sleeve_length', '소매 길이', 'STRING', '민소매, 반소매, 5부, 7부, 긴소매 등', '{"enum":["민소매","반소매","5부","7부","긴소매","기타"]}'::jsonb),
    ('collar_type', '칼라 형태', 'STRING', '셔츠 칼라, 테일러드 칼라, 스탠드 칼라, 후드, 칼라 없음 등', '{"enum":["셔츠 칼라","테일러드 칼라","스탠드 칼라","세일러 칼라","후드","칼라 없음","기타"]}'::jsonb),
    ('neckline', '넥라인', 'STRING', '라운드넥, 브이넥, 스퀘어넥, 터틀넥 등', '{}'::jsonb),
    ('closure_type', '여밈 방식', 'STRING', '지퍼, 단추, 스냅, 후크, 풀오버 또는 복합 여밈', '{}'::jsonb),
    ('pocket_count', '보이는 포켓 수', 'NUMBER', '제공된 이미지에서 직접 확인되는 외부 포켓의 수', '{"minimum":0,"maximum":20}'::jsonb),
    ('pocket_type', '포켓 형태', 'STRING', '플랩, 패치, 웰트, 지퍼 포켓 등 보이는 포켓 구조', '{}'::jsonb),
    ('adjustable_detail', '조절 디테일', 'STRING', '허리·밑단·소매·후드의 스트링, 벨트, 탭, 버튼 조절 구조', '{}'::jsonb),
    ('lining', '안감', 'BOOLEAN', '의류 내부에 별도 안감이 있는지 여부', '{}'::jsonb)
) as seed(key, display_name, value_type, description, validation_rules)
where not exists (
  select 1 from public.fact_definitions existing where existing.key = seed.key
);

-- FASHION 공통 Fact: 사용자 확인이 필요한 정보와 이미지 후보를 함께 정의한다.
insert into public.category_fact_definitions (
  category_key, fact_definition_id, ask_user, importance
)
select 'FASHION', definition.id, seed.ask_user, seed.importance
from (
  values
    ('color', true, 'REQUIRED'),
    ('pattern', false, 'RECOMMENDED'),
    ('fit', true, 'RECOMMENDED'),
    ('material', true, 'REQUIRED'),
    ('material_composition', true, 'RECOMMENDED'),
    ('size_options', true, 'REQUIRED'),
    ('measurements', true, 'REQUIRED'),
    ('care_instructions', true, 'RECOMMENDED'),
    ('country_of_origin', true, 'RECOMMENDED')
) as seed(fact_key, ask_user, importance)
join public.fact_definitions definition on definition.key = seed.fact_key
where not exists (
  select 1
  from public.category_fact_definitions existing
  where existing.category_key = 'FASHION'
    and existing.fact_definition_id = definition.id
);

-- FASHION_TOP 전용 Fact. FASHION 공통 Fact는 앱에서 부모 카테고리로 상속된다.
insert into public.category_fact_definitions (
  category_key, fact_definition_id, ask_user, importance
)
select 'FASHION_TOP', definition.id, seed.ask_user, seed.importance
from (
  values
    ('garment_type', true, 'REQUIRED'),
    ('silhouette', false, 'RECOMMENDED'),
    ('length_type', false, 'RECOMMENDED'),
    ('sleeve_length', false, 'RECOMMENDED'),
    ('collar_type', false, 'RECOMMENDED'),
    ('neckline', false, 'RECOMMENDED'),
    ('closure_type', false, 'RECOMMENDED'),
    ('pocket_count', false, 'RECOMMENDED'),
    ('pocket_type', false, 'RECOMMENDED'),
    ('adjustable_detail', false, 'RECOMMENDED'),
    ('lining', true, 'RECOMMENDED')
) as seed(fact_key, ask_user, importance)
join public.fact_definitions definition on definition.key = seed.fact_key
where not exists (
  select 1
  from public.category_fact_definitions existing
  where existing.category_key = 'FASHION_TOP'
    and existing.fact_definition_id = definition.id
);

commit;
