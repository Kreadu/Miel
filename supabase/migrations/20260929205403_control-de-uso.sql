-- S21-04 — Control de uso (acciones importantes con quién las hizo) y clasificación de costo del
-- trabajador (gasto/costo, fijo/variable). Ver specs/done/S21-04-control-de-uso.md. Idempotente.

-- 1. Registro de acciones importantes.
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  -- Trabajador identificado con su código en el modo tienda (null = la cuenta misma).
  worker_id uuid references public.workers(id) on delete set null,
  action text not null check (action in (
    'sale_created', 'sale_confirmed', 'payment_registered', 'cash_opened', 'cash_closed',
    'purchase_received', 'stock_adjusted'
  )),
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_tenant_created_idx on public.activity_log (tenant_id, created_at desc);
create index if not exists activity_log_worker_id_idx on public.activity_log (worker_id);

alter table public.activity_log enable row level security;

-- Cualquiera de la empresa registra SUS acciones (actor = él mismo); solo owner/admin las leen.
drop policy if exists "activity_log_member_insert" on public.activity_log;
create policy "activity_log_member_insert" on public.activity_log for insert
  with check (tenant_id in (select public.user_tenant_ids()) and actor_user_id = auth.uid());
drop policy if exists "activity_log_admin_select" on public.activity_log;
create policy "activity_log_admin_select" on public.activity_log for select
  using (public.user_is_tenant_admin(tenant_id));

grant select, insert on public.activity_log to authenticated;
-- Sin update/delete: el registro no se edita.

-- El trabajador del registro es de la misma empresa.
create or replace function public.check_activity_worker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.worker_id is not null and not exists (
    select 1 from public.workers where id = new.worker_id and tenant_id = new.tenant_id
  ) then
    raise exception 'worker_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists activity_log_check_worker on public.activity_log;
create trigger activity_log_check_worker
  before insert on public.activity_log
  for each row execute function public.check_activity_worker();

-- 2. Clasificación de costo del trabajador (para finanzas: su pago es gasto o costo, fijo o variable).
alter table public.workers add column if not exists cost_classification text;
alter table public.workers drop constraint if exists workers_cost_classification_check;
alter table public.workers add constraint workers_cost_classification_check check (
  cost_classification is null
  or cost_classification in ('gasto_fijo', 'gasto_variable', 'costo_fijo', 'costo_variable')
);
grant select (cost_classification), insert (cost_classification), update (cost_classification)
  on public.workers to authenticated;
