-- S5-01 — Clientes: tabla customers + RLS (select para todo el tenant, write solo
-- owner/admin) + documento único por tenant cuando está presente.
-- Ver specs/done/S5-01-clientes.md, docs/arch/multitenancy-rls.md, docs/arch/permisos-roles.md.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  doc_type text check (doc_type in ('nit', 'cc', 'ce', 'other')),
  doc_number text,
  email text,
  phone text,
  address text,
  note text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_tenant_id_idx on public.customers (tenant_id);

-- Documento único por tenant solo cuando está presente (permite múltiples clientes sin documento).
create unique index customers_tenant_doc_key
  on public.customers (tenant_id, doc_type, doc_number) 
  where doc_number is not null and doc_number != '';

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

-- Ver clientes: visible a todo el equipo del tenant (owner/admin/member), a nivel de fila.
create policy "customers_tenant_select" on public.customers for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Gestionar catálogos: solo owner/admin (permisos-roles.md). Sin política de delete:
-- el borrado es lógico vía `active` (soft-delete), nunca DELETE físico.
create policy "customers_admin_write" on public.customers for insert
  with check (public.user_is_tenant_admin(tenant_id));

create policy "customers_admin_update" on public.customers for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update on public.customers to authenticated, service_role;
