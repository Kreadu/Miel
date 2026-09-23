-- S2-01 — Bodegas: tabla warehouses + RLS (select para todo el tenant, write solo
-- owner/admin). Ver specs/S2-01-bodegas.md, docs/arch/multitenancy-rls.md.

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index warehouses_tenant_id_idx on public.warehouses (tenant_id);

create trigger warehouses_set_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();

alter table public.warehouses enable row level security;

-- Ver inventario: visible a todo el equipo del tenant (owner/admin/member).
create policy "warehouses_tenant_select" on public.warehouses for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Gestionar catálogos: solo owner/admin (permisos-roles.md). Sin política de delete:
-- el borrado es lógico vía `active` (soft-delete), nunca DELETE físico (spec S2-01).
create policy "warehouses_admin_write" on public.warehouses for insert
  with check (public.user_is_tenant_admin(tenant_id));

create policy "warehouses_admin_update" on public.warehouses for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update on public.warehouses to authenticated, service_role;
