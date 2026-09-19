-- S3-01 — Proveedores: tabla suppliers + RLS (select para todo el tenant, write solo
-- owner/admin) + NIT único por tenant cuando está presente.
-- Ver specs/done/S3-01-proveedores.md, docs/arch/multitenancy-rls.md, docs/arch/permisos-roles.md.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  nit text,
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_tenant_id_idx on public.suppliers (tenant_id);

-- NIT único por tenant solo cuando está presente (permite múltiples proveedores sin NIT).
create unique index suppliers_tenant_nit_key
  on public.suppliers (tenant_id, nit) where nit is not null;

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

-- Ver proveedores: visible a todo el equipo del tenant (owner/admin/member), a nivel de fila.
create policy "suppliers_tenant_select" on public.suppliers for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Gestionar catálogos: solo owner/admin (permisos-roles.md). Sin política de delete:
-- el borrado es lógico vía `active` (soft-delete), nunca DELETE físico (spec S3-01).
create policy "suppliers_admin_write" on public.suppliers for insert
  with check (public.user_is_tenant_admin(tenant_id));

create policy "suppliers_admin_update" on public.suppliers for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update on public.suppliers to authenticated, service_role;
