-- S21-02c — RRHH: cargos como lista propia, contacto de urgencia y trabajadores temporales o
-- por horas. Ver specs/done/S21-02-trabajadores-y-categorias.md (ajuste). Idempotente.

-- 1. Cargos de la empresa.
create table if not exists public.worker_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists worker_positions_tenant_id_idx on public.worker_positions (tenant_id);

alter table public.worker_positions enable row level security;

drop policy if exists "worker_positions_admin_all" on public.worker_positions;
create policy "worker_positions_admin_all" on public.worker_positions for all
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update, delete on public.worker_positions to authenticated, service_role;

-- 2. Columnas nuevas del trabajador.
alter table public.workers
  add column if not exists position_id uuid references public.worker_positions(id) on delete set null,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_phone text,
  add column if not exists worker_type text not null default 'planta',
  add column if not exists hourly_rate numeric(14,2) not null default 0,
  add column if not exists end_date date;

alter table public.workers drop constraint if exists workers_worker_type_check;
alter table public.workers add constraint workers_worker_type_check
  check (worker_type in ('planta', 'temporal', 'por_horas'));
alter table public.workers drop constraint if exists workers_hourly_rate_check;
alter table public.workers add constraint workers_hourly_rate_check check (hourly_rate >= 0);

create index if not exists workers_position_id_idx on public.workers (position_id);

-- 3. Los cargos escritos a mano pasan a la lista (solo si la columna vieja todavía existe).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workers' and column_name = 'position'
  ) then
    insert into public.worker_positions (tenant_id, name, created_by)
    select distinct w.tenant_id, trim(w.position), w.created_by
    from public.workers w
    where coalesce(trim(w.position), '') <> ''
    on conflict (tenant_id, name) do nothing;

    update public.workers w
    set position_id = p.id
    from public.worker_positions p
    where p.tenant_id = w.tenant_id and p.name = trim(w.position) and w.position_id is null;

    alter table public.workers drop column position;
  end if;
end $$;

-- 4. Coherencia: categoría, cargo y bodega de la misma empresa.
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
  if new.position_id is not null and not exists (
    select 1 from public.worker_positions where id = new.position_id and tenant_id = new.tenant_id
  ) then
    raise exception 'position_invalid' using errcode = 'P0001';
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
  before insert or update of category_id, position_id, warehouse_id, tenant_id on public.workers
  for each row execute function public.check_worker_refs();
