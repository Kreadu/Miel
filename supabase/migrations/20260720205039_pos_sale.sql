-- S5-10 — Pantalla POS de venta rápida: RPC register_pos_sale (venta de mostrador en un paso).
-- Última pieza del POS (ADR-017). Ver specs/S5-10-pos-venta-rapida.md.
--
-- register_pos_sale REUTILIZA create_sale (ítems + descuentos + totales netos) y confirm_sale
-- (salida de stock + costo congelado + consecutivo de recibo) — cero duplicación de lógica —,
-- liga la venta y los cobros a la sesión de caja abierta del usuario y registra los pagos
-- (mixtos permitidos). Es la primera RPC que puebla sales.cash_session_id y
-- customer_payments.cash_session_id, dando sentido al arqueo de S5-09.

-- customer_id nullable: el cobro de mostrador anónimo (venta sin cliente) se liga a la caja y
-- cuenta en el arqueo. No rompe customer_balances (LEFT JOIN desde customers: los pagos sin
-- cliente no suman a ningún saldo) ni close_cash_session (suma por cash_session_id + method).
-- La FK on delete restrict se mantiene (ahora nullable).
alter table public.customer_payments alter column customer_id drop not null;

create or replace function public.register_pos_sale(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_customer_id uuid default null,
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
  v_sale_id uuid;
  v_total numeric;
  v_pay jsonb;
  v_pay_sum numeric := 0;
  v_method text;
  v_amount numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  -- Sesión de caja abierta del usuario en el tenant (exigida: no se vende sin turno).
  select id into v_session_id
  from public.cash_sessions
  where opened_by = v_user_id and tenant_id = p_tenant_id and status = 'open'
  limit 1;

  if v_session_id is null then
    raise exception 'pos_no_open_session' using errcode = 'P0001';
  end if;

  if p_payments is null or jsonb_array_length(p_payments) < 1 then
    raise exception 'pos_payment_invalid' using errcode = 'P0001';
  end if;

  -- 1. Crear la venta (draft + ítems + descuentos + totales netos calculados en BD).
  v_sale_id := public.create_sale(p_tenant_id, p_items, p_customer_id, p_note);

  select total into v_total from public.sales where id = v_sale_id;

  -- 2. Validar pagos y que su suma cubra exactamente el total (redondeo a 2 decimales para no
  --    fallar por ruido de numeric). Cualquier raise revierte la venta creada arriba (atómico).
  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_method := v_pay->>'method';
    v_amount := (v_pay->>'amount')::numeric;
    if v_method not in ('cash', 'transfer', 'card', 'other') then
      raise exception 'pos_payment_invalid' using errcode = 'P0001';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'pos_payment_invalid' using errcode = 'P0001';
    end if;
    v_pay_sum := v_pay_sum + v_amount;
  end loop;

  if round(v_pay_sum, 2) <> round(v_total, 2) then
    raise exception 'pos_payment_mismatch' using errcode = 'P0001';
  end if;

  -- 3. Confirmar: salida de stock + congelamiento de costo + consecutivo de recibo.
  --    Un fallo aquí (p. ej. stock_insufficient) revierte todo, sin consumir número de recibo.
  perform public.confirm_sale(v_sale_id, p_warehouse_id);

  -- 4. Ligar la venta al turno de caja.
  update public.sales set cash_session_id = v_session_id where id = v_sale_id;

  -- 5. Registrar los pagos, ligados a la sesión (los 'cash' alimentan el esperado del arqueo).
  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    insert into public.customer_payments (
      tenant_id, customer_id, sale_id, amount, method, cash_session_id, paid_at, created_by
    ) values (
      p_tenant_id, p_customer_id, v_sale_id, (v_pay->>'amount')::numeric, v_pay->>'method',
      v_session_id, now(), v_user_id
    );
  end loop;

  return v_sale_id;
end;
$$;

revoke all on function public.register_pos_sale(uuid, uuid, jsonb, jsonb, uuid, text) from public, anon;
grant execute on function public.register_pos_sale(uuid, uuid, jsonb, jsonb, uuid, text) to authenticated;
