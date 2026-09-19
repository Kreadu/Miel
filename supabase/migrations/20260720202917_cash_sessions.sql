-- S5-09 — Apertura/cierre de caja con arqueo: tabla cash_sessions, RPCs
-- open_cash_session/close_cash_session y vista cash_session_summary. Segunda pieza del POS
-- (ADR-017), después de descuentos/consecutivo (S5-08). Ver specs/S5-09-caja-arqueo.md.
--
-- Permisos (permisos-roles.md): member abre/cierra únicamente SU sesión; owner/admin ven y
-- pueden cerrar cualquier sesión del tenant. `sales.cash_session_id` existía sin FK desde
-- S5-02 (la tabla no existía todavía) — esta migración le agrega la referencia ahora que
-- cash_sessions existe. `customer_payments.cash_session_id` NO se creó en S5-04 (columna
-- documentada en data-model.md pero pendiente): se agrega aquí, nullable, para que los
-- cobros de mostrador liguen a la sesión y cuenten en el arqueo.

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(14,2) not null check (opening_amount >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  counted_amount numeric(14,2),
  expected_amount numeric(14,2),
  difference numeric(14,2),
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index cash_sessions_tenant_id_idx on public.cash_sessions (tenant_id);
create index cash_sessions_opened_by_idx on public.cash_sessions (opened_by);

-- Red de seguridad a nivel de fila, además de la validación explícita en open_cash_session:
-- un usuario no puede tener dos sesiones abiertas en su tenant.
create unique index cash_sessions_one_open_per_user
  on public.cash_sessions (tenant_id, opened_by)
  where status = 'open';

alter table public.cash_sessions enable row level security;

-- Solo lectura por RLS: toda escritura entra por open_cash_session/close_cash_session
-- (security definer). member ve solo su propia sesión; owner/admin ven todas las del tenant.
create policy "cash_sessions_tenant_select" on public.cash_sessions for select
  using (
    tenant_id in (select public.user_tenant_ids())
    and (opened_by = auth.uid() or public.user_is_tenant_admin(tenant_id))
  );

grant select on public.cash_sessions to authenticated, service_role;

alter table public.sales
  add constraint sales_cash_session_id_fkey
  foreign key (cash_session_id) references public.cash_sessions(id) on delete restrict;

alter table public.customer_payments
  add column cash_session_id uuid references public.cash_sessions(id) on delete restrict;

create index customer_payments_cash_session_id_idx on public.customer_payments (cash_session_id);

-- open_cash_session: abre sesión para el usuario autenticado en su tenant. Invariante: no
-- puede tener ya una sesión open (cash_session_already_open).
create or replace function public.open_cash_session(
  p_opening_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_session_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_opening_amount is null or p_opening_amount < 0 then
    raise exception 'opening_amount_invalid' using errcode = 'P0001';
  end if;

  select tenant_id into v_tenant_id
  from public.memberships
  where user_id = v_user_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cash_sessions
    where opened_by = v_user_id and tenant_id = v_tenant_id and status = 'open'
  ) then
    raise exception 'cash_session_already_open' using errcode = 'P0001';
  end if;

  insert into public.cash_sessions (
    tenant_id, opened_by, opening_amount, created_by
  ) values (
    v_tenant_id, v_user_id, p_opening_amount, v_user_id
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.open_cash_session(numeric) from public, anon;
grant execute on function public.open_cash_session(numeric) to authenticated;

-- close_cash_session: cierra una sesión open, calculando el esperado en BD. Sin p_session_id
-- cierra la sesión open del propio usuario; con p_session_id de otro usuario, exige
-- user_is_tenant_admin. Invariante: no cerrar dos veces (cash_session_not_open).
create or replace function public.close_cash_session(
  p_counted_amount numeric,
  p_session_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_session_id uuid;
  v_tenant_id uuid;
  v_opened_by uuid;
  v_status text;
  v_opening_amount numeric;
  v_cash_payments numeric;
  v_expected numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_counted_amount is null or p_counted_amount < 0 then
    raise exception 'counted_amount_invalid' using errcode = 'P0001';
  end if;

  if p_session_id is null then
    select id into v_session_id
    from public.cash_sessions
    where opened_by = v_user_id and status = 'open'
    limit 1;
  else
    v_session_id := p_session_id;
  end if;

  if v_session_id is null then
    raise exception 'cash_session_not_open' using errcode = 'P0001';
  end if;

  select tenant_id, opened_by, status, opening_amount
    into v_tenant_id, v_opened_by, v_status, v_opening_amount
  from public.cash_sessions
  where id = v_session_id
    and tenant_id in (select public.user_tenant_ids())
  for update;

  if v_tenant_id is null then
    raise exception 'cash_session_not_found' using errcode = 'P0001';
  end if;

  if v_opened_by <> v_user_id and not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status <> 'open' then
    raise exception 'cash_session_not_open' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_cash_payments
  from public.customer_payments
  where cash_session_id = v_session_id and method = 'cash';

  v_expected := v_opening_amount + v_cash_payments;

  update public.cash_sessions
  set status = 'closed',
      closed_at = now(),
      counted_amount = p_counted_amount,
      expected_amount = v_expected,
      difference = p_counted_amount - v_expected,
      note = coalesce(p_note, note)
  where id = v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.close_cash_session(numeric, uuid, text) from public, anon;
grant execute on function public.close_cash_session(numeric, uuid, text) to authenticated;

-- Vista de resumen por sesión: ventas del turno, cobros por método, esperado vs contado.
-- Repite el filtro de tenant + rol explícitamente (mismo patrón que customer_balances): una
-- vista no hereda automáticamente la política de la tabla base para el dueño de las tablas.
create or replace view public.cash_session_summary as
with sale_totals as (
  select cash_session_id, count(*) as sales_count, coalesce(sum(total), 0) as sales_total
  from public.sales
  where cash_session_id is not null
  group by cash_session_id
),
payment_totals as (
  select
    cash_session_id,
    coalesce(sum(amount) filter (where method = 'cash'), 0) as cash_total,
    coalesce(sum(amount) filter (where method = 'transfer'), 0) as transfer_total,
    coalesce(sum(amount) filter (where method = 'card'), 0) as card_total,
    coalesce(sum(amount) filter (where method = 'other'), 0) as other_total
  from public.customer_payments
  where cash_session_id is not null
  group by cash_session_id
)
select
  cs.tenant_id,
  cs.id as cash_session_id,
  cs.opened_by,
  cs.opened_at,
  cs.opening_amount,
  cs.status,
  cs.closed_at,
  cs.counted_amount,
  cs.expected_amount,
  cs.difference,
  coalesce(st.sales_count, 0) as sales_count,
  coalesce(st.sales_total, 0) as sales_total,
  coalesce(pt.cash_total, 0) as cash_total,
  coalesce(pt.transfer_total, 0) as transfer_total,
  coalesce(pt.card_total, 0) as card_total,
  coalesce(pt.other_total, 0) as other_total
from public.cash_sessions cs
left join sale_totals st on st.cash_session_id = cs.id
left join payment_totals pt on pt.cash_session_id = cs.id
where cs.tenant_id in (select public.user_tenant_ids())
  and (cs.opened_by = auth.uid() or public.user_is_tenant_admin(cs.tenant_id));

grant select on public.cash_session_summary to authenticated;
