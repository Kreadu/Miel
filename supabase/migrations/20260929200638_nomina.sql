-- S21-05 — Nómina: licencias, períodos, liquidaciones por trabajador y nómina electrónica DIAN.
-- El cálculo lo hace el motor copiado de Gestion-Future (src/lib/rrhh, ADR-036) en el servidor;
-- aquí se guarda el resultado. Todo solo owner/admin (salarios). Ver
-- specs/done/S21-05-nomina.md. Idempotente.

-- 1. Licencias e incapacidades (mismos tipos que el motor).
create table if not exists public.worker_leaves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  worker_id uuid not null references public.workers(id) on delete cascade,
  type text not null check (type in (
    'GENERAL_INCAPACITY', 'WORK_INCAPACITY', 'MATERNITY_LEAVE', 'PATERNITY_LEAVE'
  )),
  start_date date not null,
  end_date date not null,
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists worker_leaves_tenant_id_idx on public.worker_leaves (tenant_id);
create index if not exists worker_leaves_worker_id_idx on public.worker_leaves (worker_id);

-- 2. Períodos de nómina.
create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'closed')),
  closed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, period_start, period_end),
  check (period_end >= period_start)
);
create index if not exists payroll_periods_tenant_id_idx on public.payroll_periods (tenant_id);

-- 3. Liquidación de cada trabajador en un período (novedades + resultado del motor).
create table if not exists public.payroll_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  days_worked numeric(5,2) not null default 0 check (days_worked >= 0 and days_worked <= 30),
  extra_diurna numeric(6,2) not null default 0 check (extra_diurna >= 0),
  extra_nocturna numeric(6,2) not null default 0 check (extra_nocturna >= 0),
  recargo_nocturno numeric(6,2) not null default 0 check (recargo_nocturno >= 0),
  horas_dominical_festivo numeric(6,2) not null default 0 check (horas_dominical_festivo >= 0),
  hours_worked numeric(7,2) not null default 0 check (hours_worked >= 0),
  weekly_hours numeric(5,2) not null default 0 check (weekly_hours >= 0),
  gross_earnings numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  result jsonb not null default '{}'::jsonb,
  dian_status text not null default 'pending' check (dian_status in ('pending', 'generated')),
  dian_consecutive integer,
  dian_cune text,
  dian_xml text,
  dian_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, worker_id)
);
create index if not exists payroll_settlements_tenant_id_idx on public.payroll_settlements (tenant_id);
create index if not exists payroll_settlements_period_id_idx on public.payroll_settlements (period_id);
create index if not exists payroll_settlements_worker_id_idx on public.payroll_settlements (worker_id);

drop trigger if exists payroll_settlements_set_updated_at on public.payroll_settlements;
create trigger payroll_settlements_set_updated_at
  before update on public.payroll_settlements
  for each row execute function public.set_updated_at();

-- 4. Datos DIAN de la empresa (NIT, software de nómina electrónica).
create table if not exists public.dian_settings (
  tenant_id uuid primary key references public.tenants(id),
  nit text not null,
  dv text not null,
  company_name text not null,
  software_id text not null,
  software_pin text not null,
  test_set_id text,
  address text,
  city text,
  department text,
  email text,
  phone text,
  updated_at timestamptz not null default now()
);

-- 5. Consecutivo de nómina electrónica por empresa.
create table if not exists public.dian_counters (
  tenant_id uuid primary key references public.tenants(id),
  last_consecutive integer not null default 0
);

-- RLS: todo solo owner/admin del tenant.
do $$
declare
  t text;
begin
  foreach t in array array['worker_leaves', 'payroll_periods', 'payroll_settlements', 'dian_settings', 'dian_counters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_admin_all" on public.%I', t, t);
    execute format(
      'create policy "%s_admin_all" on public.%I for all using (public.user_is_tenant_admin(tenant_id)) with check (public.user_is_tenant_admin(tenant_id))',
      t, t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- Coherencia: la licencia y la liquidación son de un trabajador (y período) de la misma empresa.
create or replace function public.check_payroll_refs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.workers where id = new.worker_id and tenant_id = new.tenant_id) then
    raise exception 'worker_invalid' using errcode = 'P0001';
  end if;
  if tg_table_name = 'payroll_settlements' and not exists (
    select 1 from public.payroll_periods where id = new.period_id and tenant_id = new.tenant_id
  ) then
    raise exception 'period_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists worker_leaves_check_refs on public.worker_leaves;
create trigger worker_leaves_check_refs
  before insert or update on public.worker_leaves
  for each row execute function public.check_payroll_refs();

drop trigger if exists payroll_settlements_check_refs on public.payroll_settlements;
create trigger payroll_settlements_check_refs
  before insert or update of worker_id, period_id, tenant_id on public.payroll_settlements
  for each row execute function public.check_payroll_refs();

-- Siguiente consecutivo DIAN, atómico (dos generaciones simultáneas no repiten número).
create or replace function public.next_dian_consecutive(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if not public.user_is_tenant_admin(p_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  insert into public.dian_counters as c (tenant_id, last_consecutive)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update set last_consecutive = c.last_consecutive + 1
  returning c.last_consecutive into v_next;
  return v_next;
end;
$$;

revoke all on function public.next_dian_consecutive(uuid) from public, anon;
grant execute on function public.next_dian_consecutive(uuid) to authenticated;

-- Crear un período con sus liquidaciones de una sola vez (atómico): el cálculo lo hace el motor
-- en el servidor; esta función solo guarda. security invoker: aplica la RLS owner/admin.
create or replace function public.create_payroll_period(
  p_tenant_id uuid,
  p_start date,
  p_end date,
  p_settlements jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period_id uuid;
begin
  insert into public.payroll_periods (tenant_id, period_start, period_end)
  values (p_tenant_id, p_start, p_end)
  returning id into v_period_id;

  insert into public.payroll_settlements (
    tenant_id, period_id, worker_id, days_worked, extra_diurna, extra_nocturna, recargo_nocturno,
    horas_dominical_festivo, hours_worked, weekly_hours, gross_earnings, total_deductions, net_pay,
    result
  )
  select
    p_tenant_id, v_period_id, (s->>'worker_id')::uuid,
    coalesce((s->>'days_worked')::numeric, 0), coalesce((s->>'extra_diurna')::numeric, 0),
    coalesce((s->>'extra_nocturna')::numeric, 0), coalesce((s->>'recargo_nocturno')::numeric, 0),
    coalesce((s->>'horas_dominical_festivo')::numeric, 0), coalesce((s->>'hours_worked')::numeric, 0),
    coalesce((s->>'weekly_hours')::numeric, 0), coalesce((s->>'gross_earnings')::numeric, 0),
    coalesce((s->>'total_deductions')::numeric, 0), coalesce((s->>'net_pay')::numeric, 0),
    coalesce(s->'result', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_settlements, '[]'::jsonb)) s;

  return v_period_id;
end;
$$;

revoke all on function public.create_payroll_period(uuid, date, date, jsonb) from public, anon;
grant execute on function public.create_payroll_period(uuid, date, date, jsonb) to authenticated;
