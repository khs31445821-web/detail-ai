create table if not exists public.store_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  shipping_fee bigint,
  free_shipping_threshold bigint,
  average_dispatch_time text,
  shipping_method text,
  remote_area_fee bigint,
  return_exchange_window text,
  return_shipping_fee bigint,
  exchange_shipping_fee bigint,
  customer_service text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_store_overrides (
  product_id uuid primary key references public.products(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  shipping_fee bigint,
  free_shipping_threshold bigint,
  average_dispatch_time text,
  shipping_method text,
  remote_area_fee bigint,
  return_exchange_window text,
  return_shipping_fee bigint,
  exchange_shipping_fee bigint,
  customer_service text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_store_overrides_workspace_id_idx
  on public.product_store_overrides(workspace_id);

alter table public.store_profiles enable row level security;
alter table public.product_store_overrides enable row level security;

drop policy if exists "store_profiles_workspace_members" on public.store_profiles;
create policy "store_profiles_workspace_members"
on public.store_profiles
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "product_store_overrides_workspace_members" on public.product_store_overrides;
create policy "product_store_overrides_workspace_members"
on public.product_store_overrides
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.products p
    where p.id = product_store_overrides.product_id
      and p.workspace_id = product_store_overrides.workspace_id
  )
)
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.products p
    where p.id = product_store_overrides.product_id
      and p.workspace_id = product_store_overrides.workspace_id
  )
);
