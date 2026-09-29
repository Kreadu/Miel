-- S19-15 — Categorías de producto: tabla nueva + products.category_id. Ver
-- specs/S19-15-categorias-de-producto.md. Idempotente (SQL Editor corre cada sentencia aparte).

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.product_categories enable row level security;

drop policy if exists "product_categories_tenant_select" on public.product_categories;
create policy "product_categories_tenant_select" on public.product_categories for select
  using (tenant_id in (select public.user_tenant_ids()));

drop policy if exists "product_categories_admin_write" on public.product_categories;
create policy "product_categories_admin_write" on public.product_categories for insert
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert on public.product_categories to authenticated, service_role;

alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete set null;

-- category_id va al final del select, mismo motivo de siempre (42P16, ver S19-02/S19-05).
create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate,
  photo_url, discount_percent, sales_channel, category_id
from public.products
where tenant_id in (select public.user_tenant_ids());

grant select (
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  photo_url, discount_percent, sales_channel, category_id, created_by, created_at, updated_at
) on public.products to authenticated, service_role;
