-- S21-02 — RRHH: categorías de trabajador (qué módulos ve cada una) y trabajadores.
-- Ver specs/done/S21-02-trabajadores-y-categorias.md. Idempotente.
-- Solo owner/admin leen y escriben: hay datos sensibles (salario, documento, seguridad social).

create table if not exists public.worker_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  -- Módulos que ve un trabajador de esta categoría (el ingreso con código llega en S21-03).
  modules text[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  constraint worker_categories_modules_check
    check (modules <@ array['ventas', 'inventario', 'compras', 'gastos', 'rrhh']::text[])
);

create index if not exists worker_categories_tenant_id_idx on public.worker_categories (tenant_id);

drop trigger if exists worker_categories_set_updated_at on public.worker_categories;
create trigger worker_categories_set_updated_at
  before update on public.worker_categories
  for each row execute function public.set_updated_at();

alter table public.worker_categories enable row level security;

drop policy if exists "worker_categories_admin_all" on public.worker_categories;
create policy "worker_categories_admin_all" on public.worker_categories for all
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update, delete on public.worker_categories to authenticated, service_role;

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  full_name text not null,
  doc_type text not null default 'cc' check (doc_type in ('cc', 'ce', 'ti', 'pasaporte', 'ppt')),
  doc_number text not null,
  position text,
  hire_date date,
  contract_type text not null default 'indefinido' check (contract_type in (
    'indefinido', 'fijo', 'obra_labor', 'aprendizaje', 'prestacion_servicios'
  )),
  salary numeric(14,2) not null default 0 check (salary >= 0),
  work_schedule text not null default 'completa' check (work_schedule in (
    'completa', 'medio_tiempo', 'por_horas'
  )),
  eps text,
  pension_fund text,
  arl_risk_class smallint check (arl_risk_class between 1 and 5),
  phone text,
  email text,
  address text,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  category_id uuid references public.worker_categories(id) on delete set null,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, doc_type, doc_number)
);

create index if not exists workers_tenant_id_idx on public.workers (tenant_id);
create index if not exists workers_category_id_idx on public.workers (category_id);
create index if not exists workers_warehouse_id_idx on public.workers (warehouse_id);

drop trigger if exists workers_set_updated_at on public.workers;
create trigger workers_set_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

alter table public.workers enable row level security;

-- Sin borrado físico: se archiva con `active` (sus registros de uso lo referenciarán, S21-04).
drop policy if exists "workers_admin_select" on public.workers;
create policy "workers_admin_select" on public.workers for select
  using (public.user_is_tenant_admin(tenant_id));

drop policy if exists "workers_admin_insert" on public.workers;
create policy "workers_admin_insert" on public.workers for insert
  with check (public.user_is_tenant_admin(tenant_id));

drop policy if exists "workers_admin_update" on public.workers;
create policy "workers_admin_update" on public.workers for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update on public.workers to authenticated, service_role;

-- Coherencia: la categoría y la bodega o sucursal del trabajador son de su misma empresa.
create or replace function public.check_worker_refs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.worker_categories where id = new.category_id and tenant_id = new.tenant_id
  ) then
    raise exception 'category_invalid' using errcode = 'P0001';
  end if;
  if new.warehouse_id is not null and not exists (
    select 1 from public.warehouses where id = new.warehouse_id and tenant_id = new.tenant_id
  ) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists workers_check_refs on public.workers;
create trigger workers_check_refs
  before insert or update of category_id, warehouse_id, tenant_id on public.workers
  for each row execute function public.check_worker_refs();
