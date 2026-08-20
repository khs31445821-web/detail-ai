begin;

-- 이미 패션 카탈로그가 생성된 환경에서도 실측 사이즈를 필수 Fact로 승격한다.
update public.category_fact_definitions as category_fact
set
  ask_user = true,
  importance = 'REQUIRED'
from public.fact_definitions as definition
where category_fact.category_key = 'FASHION'
  and category_fact.fact_definition_id = definition.id
  and definition.key = 'measurements';

-- 의류 종류도 AI 후보 확인에만 머물지 않고 판매자가 직접 확정할 수 있게 한다.
update public.category_fact_definitions as category_fact
set
  ask_user = true,
  importance = 'REQUIRED'
from public.fact_definitions as definition
where category_fact.category_key = 'FASHION_TOP'
  and category_fact.fact_definition_id = definition.id
  and definition.key = 'garment_type';

commit;
