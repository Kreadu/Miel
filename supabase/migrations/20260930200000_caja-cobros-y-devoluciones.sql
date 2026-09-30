-- S18-08 — Todo cobro entra a la caja de quien cobra; una venta cobrada no se anula (se devuelve
-- desde Caja con refund_sale: owner/admin, caja abierta, motivo, stock de vuelta).

alter table public.sales
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refunded_by uuid references auth.users(id);

alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sale_created', 'sale_confirmed', 'sale_cancelled', 'payment_registered', 'cash_opened', 'cash_closed',
  'purchase_received', 'stock_adjusted', 'sale_refunded'
));

-- 1. Cobro → caja de quien cobra. Mismas validaciones que antes (S5-04); al final: el cobro queda
--    ligado a la caja abierta del usuario; en efectivo la caja es obligatoria.
create or replace function public.register_customer_payment(
  p_customer_id uuid,
  p_sale_id uuid,
  p_amount numeric,
  p_method text,
  p_paid_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_sale_tenant uuid;
  v_sale_customer uuid;
  v_sale_status text;
  v_sale_total numeric;
  v_paid_so_far numeric;
  v_session_id uuid;
  v_payment_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_amount <= 0 then
    raise exception 'payment_amount_invalid' using errcode = 'P0001';
  end if;

  if p_method not in ('cash', 'transfer', 'card', 'other') then
    raise exception 'payment_method_invalid' using errcode = 'P0001';
  end if;

  select tenant_id into v_tenant_id
  from public.customers
  where id = p_customer_id and active;

  -- Evitar revelar la existencia de un cliente de otro tenant.
  if v_tenant_id is null or v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'customer_not_found' using errcode = 'P0001';
  end if;

  if p_sale_id is not null then
    select tenant_id, customer_id, status, total
      into v_sale_tenant, v_sale_customer, v_sale_status, v_sale_total
    from public.sales
    where id = p_sale_id
    for update;

    if v_sale_tenant is null or v_sale_tenant <> v_tenant_id then
      raise exception 'sale_not_found' using errcode = 'P0001';
    end if;

    if v_sale_customer is distinct from p_customer_id then
      raise exception 'sale_customer_mismatch' using errcode = 'P0001';
    end if;

    if v_sale_status not in ('confirmed', 'shipped', 'delivered') then
      raise exception 'sale_not_receivable' using errcode = 'P0001';
    end if;

    select coalesce(sum(amount), 0) into v_paid_so_far
    from public.customer_payments
    where sale_id = p_sale_id;

    if p_amount > v_sale_total - v_paid_so_far then
      raise exception 'payment_exceeds_balance' using errcode = 'P0001';
    end if;
  end if;

  select id into v_session_id from public.cash_sessions
  where tenant_id = v_tenant_id and opened_by = v_user_id and status = 'open';
  if v_session_id is null and p_method = 'cash' then
    raise exception 'cash_session_required' using errcode = 'P0001';
  end if;

  insert into public.customer_payments (
    tenant_id, customer_id, sale_id, amount, paid_at, method, note, cash_session_id, created_by
  ) values (
    v_tenant_id, p_customer_id, p_sale_id, p_amount, coalesce(p_paid_at, now()), p_method, p_note,
    v_session_id, v_user_id
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;
revoke all on function public.register_customer_payment(uuid, uuid, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.register_customer_payment(uuid, uuid, numeric, text, timestamptz, text) to authenticated;

-- 2. Anular (owner/admin) solo si la venta no tiene cobros; devuelve el stock al costo congelado.
create or replace function public.cancel_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_mov record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, status into v_tenant_id, v_status
  from public.sales where id = p_sale_id for update;
  if not found or v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'sale_not_found' using errcode = 'P0001';
  end if;
  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_status = 'cancelled' then
    raise exception 'sale_already_cancelled' using errcode = 'P0001';
  end if;
  if coalesce((select sum(amount) from public.customer_payments where sale_id = p_sale_id), 0) > 0 then
    raise exception 'sale_has_payments' using errcode = 'P0001';
  end if;

  for v_mov in
    select product_id, warehouse_id, -qty as qty, unit_cost
    from public.stock_movements
    where ref_type = 'sale' and ref_id = p_sale_id::text and qty < 0
  loop
    perform public.register_movement(
      v_mov.product_id, v_mov.warehouse_id, 'in', v_mov.qty, v_mov.unit_cost,
      'sale_cancel', p_sale_id::text, 'Anulación de venta'
    );
  end loop;

  update public.sales set status = 'cancelled', updated_at = now() where id = p_sale_id;
end;
$$;
revoke all on function public.cancel_sale(uuid) from public, anon;
grant execute on function public.cancel_sale(uuid) to authenticated;

-- 3. Devolución de una venta (completa) desde Caja: owner/admin con su caja abierta y motivo.
--    El stock vuelve a la bodega de donde salió; el dinero sale de la caja de quien devuelve.
create or replace function public.refund_sale(p_tenant_id uuid, p_receipt_number integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale record;
  v_session_id uuid;
  v_mov record;
  v_pay record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_tenant_id is null or not public.user_is_tenant_admin(p_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  select id into v_session_id from public.cash_sessions
  where tenant_id = p_tenant_id and opened_by = v_user_id and status = 'open';
  if v_session_id is null then
    raise exception 'cash_session_required' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'refund_reason_required' using errcode = 'P0001';
  end if;

  select id, customer_id, status into v_sale
  from public.sales
  where tenant_id = p_tenant_id and receipt_number = p_receipt_number
  for update;
  if not found then
    raise exception 'sale_not_found' using errcode = 'P0001';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'sale_already_cancelled' using errcode = 'P0001';
  end if;

  for v_mov in
    select product_id, warehouse_id, -qty as qty, unit_cost
    from public.stock_movements
    where ref_type = 'sale' and ref_id = v_sale.id::text and qty < 0
  loop
    perform public.register_movement(
      v_mov.product_id, v_mov.warehouse_id, 'in', v_mov.qty, v_mov.unit_cost,
      'sale_refund', v_sale.id::text, 'Devolución: ' || trim(p_reason)
    );
  end loop;

  for v_pay in
    select method, sum(amount) as amount
    from public.customer_payments
    where sale_id = v_sale.id
    group by method
    having sum(amount) > 0
  loop
    insert into public.customer_payments (
      tenant_id, customer_id, sale_id, amount, paid_at, method, note, cash_session_id, created_by
    ) values (
      p_tenant_id, v_sale.customer_id, v_sale.id, -v_pay.amount, now(), v_pay.method,
      'Devolución: ' || trim(p_reason), v_session_id, v_user_id
    );
  end loop;

  update public.sales
  set status = 'cancelled', refunded_at = now(), refund_reason = trim(p_reason), refunded_by = v_user_id,
      updated_at = now()
  where id = v_sale.id;

  return v_sale.id;
end;
$$;
revoke all on function public.refund_sale(uuid, integer, text) from public, anon;
grant execute on function public.refund_sale(uuid, integer, text) to authenticated;
