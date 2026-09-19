-- S2-02 — Productos: tabla products + RLS (select para todo el tenant, write solo
-- owner/admin) + vista products_catalog con cost/price/tax_rate enmascarados para member.
-- Ver specs/S2-02-productos.md, docs/arch/multitenancy-rls.md, docs/arch/permisos-roles.md.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  sku text not null,
  name text not null,
  description text,
  unit text not null default 'unidad',
  kind text not null default 'raw' check (kind in ('raw', 'finished', 'resale')),
  cost numeric(14,2) not null default 0,
  price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 19,
  min_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create index products_tenant_id_idx on public.products (tenant_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- Ver inventario: visible a todo el equipo del tenant (owner/admin/member), a nivel de fila.
create policy "products_tenant_select" on public.products for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Gestionar catálogos: solo owner/admin (permisos-roles.md). Sin política de delete:
-- el borrado es lógico vía `active` (soft-delete), nunca DELETE físico (spec S2-02).
create policy "products_admin_write" on public.products for insert
  with check (public.user_is_tenant_admin(tenant_id));

create policy "products_admin_update" on public.products for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

-- `cost`/`price`/`tax_rate` son "columnas sensibles" (permisos-roles.md: "Ver costos y
-- márgenes" ✖ member) — Postgres no tiene RLS a nivel de columna condicionada por rol de
-- membresía, así que la tabla base no otorga SELECT de esas 3 columnas a `authenticated`
-- (leerlas directo de `products` falla con "permission denied"); solo se leen a través de la
-- vista `products_catalog` de abajo, que las enmascara a null para quien no sea admin del
-- tenant de la fila.
grant select (
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at
) on public.products to authenticated, service_role;
grant insert, update on public.products to authenticated, service_role;

-- La vista de abajo corre con los privilegios del dueño de la tabla (necesita leer
-- cost/price/tax_rate sin el GRANT columnar de arriba). En Supabase el dueño de la tabla
-- (`postgres`) tiene `rolbypassrls`, así que `FORCE ROW LEVEL SECURITY` NO alcanza para acotar
-- el aislamiento por tenant a través de la vista (el bypass de RLS por rol gana sobre FORCE).
-- Por eso el aislamiento se repite explícitamente en el `where` de la vista, con el mismo
-- helper `user_tenant_ids()` que usa la política de la tabla — no se delega en que Postgres
-- aplique la política automáticamente al consultar vía la vista.
create view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  case when public.user_is_tenant_admin(tenant_id) then price else null end as price,
  case when public.user_is_tenant_admin(tenant_id) then tax_rate else null end as tax_rate
from public.products
where tenant_id in (select public.user_tenant_ids());

grant select on public.products_catalog to authenticated, service_role;
