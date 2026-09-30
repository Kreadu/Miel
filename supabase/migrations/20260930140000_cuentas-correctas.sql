-- S23-01 — Cuentas correctas: IVA recuperable fuera del costo, un solo costo (promedio del
-- kardex), precio de venta desde el producto, redondeo por línea, envío como ingreso, datos
-- fiscales de la empresa, IVA descontable en gastos y anulación de ventas.
-- Ver specs/S23-01-cuentas-correctas.md. Idempotente.

-- 1. Datos fiscales de la empresa (nómina 114-1 y renta estimada).
alter table public.tenants add column if not exists person_type text not null default 'juridica';
alter table public.tenants add column if not exists income_tax_rate numeric(5,2) not null default 35;
alter table public.tenants drop constraint if exists tenants_person_type_check;
alter table public.tenants add constraint tenants_person_type_check
  check (person_type in ('juridica', 'natural'));
alter table public.tenants drop constraint if exists tenants_income_tax_rate_check;
alter table public.tenants add constraint tenants_income_tax_rate_check
  check (income_tax_rate between 0 and 100);

-- 2. IVA descontable de cada gasto (no es gasto: se recupera).
alter table public.expenses add column if not exists tax_amount numeric(14,2) not null default 0;
alter table public.expenses drop constraint if exists expenses_tax_amount_check;
alter table public.expenses add constraint expenses_tax_amount_check
  check (tax_amount >= 0 and tax_amount <= amount);

-- 3. Movimientos: una entrada sin costo toma el promedio actual (o el costo de la ficha) y cada
--    entrada deja en products.cost el nuevo promedio ponderado (único costo del producto).
create or replace function public.register_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_kind text,
  p_qty numeric,
  p_unit_cost numeric,
  p_ref_type text default null,
  p_ref_id text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_user_id uuid;
  v_product_cost numeric;
  v_current_stock numeric := 0;
  v_total_value numeric := 0;
  v_avg_cost numeric := 0;
  v_final_qty numeric;
  v_final_cost numeric;
  v_warehouse_stock numeric;
  v_movement_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select tenant_id, cost into v_tenant_id, v_product_cost from public.products where id = p_product_id;
  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'Permission denied for product';
  end if;

  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'Permission denied for warehouse';
  end if;

  if p_qty <= 0 and p_kind != 'adjust' then
    raise exception 'Quantity must be positive';
  end if;

  -- Costo promedio del producto (todas las bodegas).
  select coalesce(sum(qty), 0), coalesce(sum(qty * unit_cost), 0)
  into v_current_stock, v_total_value
  from public.stock_movements
  where product_id = p_product_id and tenant_id = v_tenant_id;

  if v_current_stock > 0 then
    v_avg_cost := v_total_value / v_current_stock;
  else
    v_avg_cost := coalesce(p_unit_cost, v_product_cost, 0);
  end if;

  if p_kind in ('in', 'production_in') or (p_kind = 'adjust' and p_qty > 0) then
    v_final_qty := p_qty;
    v_final_cost := coalesce(p_unit_cost, v_avg_cost);
  elsif p_kind in ('out', 'production_out') or (p_kind = 'adjust' and p_qty < 0) then
    v_final_qty := case when p_kind = 'adjust' then p_qty else -p_qty end;
    v_final_cost := v_avg_cost;
    select coalesce(sum(qty), 0) into v_warehouse_stock
    from public.stock_movements
    where product_id = p_product_id and warehouse_id = p_warehouse_id and tenant_id = v_tenant_id;
    if v_warehouse_stock + v_final_qty < 0 then
      raise exception 'stock_insufficient' using errcode = 'P0001';
    end if;
  else
    raise exception 'Invalid kind';
  end if;

  insert into public.stock_movements (
    tenant_id, product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, created_by
  ) values (
    v_tenant_id, p_product_id, p_warehouse_id, p_kind, v_final_qty, v_final_cost, p_ref_type, p_ref_id, p_note, v_user_id
  ) returning id into v_movement_id;

  if v_final_qty > 0 then
    update public.products
    set cost = round((v_total_value + v_final_qty * v_final_cost) / (v_current_stock + v_final_qty), 2)
    where id = p_product_id and v_current_stock + v_final_qty > 0;
  end if;

  return v_movement_id;
end;
$$;

-- 4. Recibir compra: el kardex entra al costo del proveedor SIN IVA (el IVA se recupera).
--    El costo del producto lo actualiza register_movement (promedio ponderado).
create or replace function public.receive_purchase(
  p_purchase_id uuid,
  p_warehouse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_status      text;
  v_supplier_id uuid;
  v_wh_tenant   uuid;
  v_item        record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, status, supplier_id into v_tenant_id, v_status, v_supplier_id
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  select tenant_id into v_wh_tenant from public.warehouses where id = p_warehouse_id;
  if v_wh_tenant is null or v_wh_tenant <> v_tenant_id then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;

  if v_status <> 'ordered' then
    raise exception 'purchase_not_ordered' using errcode = 'P0001';
  end if;

  for v_item in
    select product_id, qty, unit_cost from public.purchase_items where purchase_id = p_purchase_id
  loop
    perform public.register_movement(
      v_item.product_id, p_warehouse_id, 'in', v_item.qty, v_item.unit_cost,
      'purchase', p_purchase_id::text, null
    );
  end loop;

  -- distinct: purchase_items no es único por (purchase_id, product_id) (ver S15-01).
  insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
  select distinct v_tenant_id, v_supplier_id, pi.product_id, now()
  from public.purchase_items pi
  where pi.purchase_id = p_purchase_id
  on conflict (supplier_id, product_id)
    do update set last_purchased_at = excluded.last_purchased_at;

  update public.purchases
  set status = 'received', received_at = now()
  where id = p_purchase_id;
end;
$$;

-- 5. Corrección de datos de prueba: entradas de compra sin IVA, entradas sin costo con el costo
--    de la ficha, y costo del producto = promedio del kardex.
update public.stock_movements sm
set unit_cost = c.cost
from (
  select purchase_id, product_id, round(sum(qty * unit_cost) / sum(qty), 2) as cost
  from public.purchase_items
  group by purchase_id, product_id
) c
where sm.ref_type = 'purchase' and sm.ref_id = c.purchase_id::text and sm.product_id = c.product_id
  and sm.qty > 0 and sm.unit_cost is distinct from c.cost;

update public.stock_movements sm
set unit_cost = coalesce(p.cost, 0)
from public.products p
where p.id = sm.product_id and sm.unit_cost is null and sm.qty > 0;

update public.products p
set cost = k.avg_cost
from (
  select product_id, round(sum(qty * unit_cost) / sum(qty), 2) as avg_cost
  from public.stock_movements
  group by product_id
  having sum(qty) > 0
) k
where p.id = k.product_id;

-- 6. Crear venta: precio, IVA y % de descuento salen del producto (el navegador solo manda
--    producto y cantidad). Redondeo por línea; el total es la suma de partes redondeadas.
create or replace function public.create_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_note text default null,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_shipping_rate_id uuid default null,
  p_shipping_km numeric default null,
  p_shipping_cost numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_product record;
  v_discount numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_weight numeric := 0;
  v_rate record;
  v_shipping numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers
    where id = p_customer_id and tenant_id = p_tenant_id and active
  ) then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;

  if p_payment_method is not null and p_payment_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception 'payment_method_invalid' using errcode = 'P0001';
  end if;

  if p_delivery_method is not null
     and p_delivery_method not in ('pickup', 'free_city', 'agreed', 'carrier') then
    raise exception 'delivery_method_invalid' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  insert into public.sales (
    tenant_id, customer_id, status, note, payment_method, delivery_method, created_by
  ) values (
    p_tenant_id, p_customer_id, 'draft', p_note, p_payment_method, p_delivery_method, v_user_id
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;

    select price, tax_rate, coalesce(discount_percent, 0) as discount_percent, coalesce(weight_kg, 0) as weight_kg
    into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and tenant_id = p_tenant_id and active;
    if not found then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    v_discount := round(v_qty * v_product.price * v_product.discount_percent / 100, 2);

    insert into public.sale_items (
      tenant_id, sale_id, product_id, qty, unit_price, discount, tax_rate
    ) values (
      p_tenant_id, v_sale_id, (v_item->>'product_id')::uuid, v_qty, v_product.price, v_discount, v_product.tax_rate
    );

    v_line := round(v_qty * v_product.price - v_discount, 2);
    v_subtotal := v_subtotal + v_line;
    v_tax := v_tax + round(v_line * v_product.tax_rate / 100, 2);
    v_weight := v_weight + v_qty * v_product.weight_kg;
  end loop;

  if p_delivery_method = 'agreed' then
    if p_shipping_cost is null or p_shipping_cost < 0 then
      raise exception 'shipping_cost_invalid' using errcode = 'P0001';
    end if;
    v_shipping := round(p_shipping_cost, 2);
  elsif p_delivery_method = 'carrier' then
    select * into v_rate from public.shipping_rates
    where id = p_shipping_rate_id and tenant_id = p_tenant_id;
    if not found then
      raise exception 'shipping_rate_invalid' using errcode = 'P0001';
    end if;
    if p_shipping_km is null or p_shipping_km < 0 then
      raise exception 'shipping_km_invalid' using errcode = 'P0001';
    end if;
    v_shipping := round(v_rate.base_price + v_rate.price_per_kg * v_weight
                        + v_rate.price_per_km * p_shipping_km, 2);
  end if;

  update public.sales
  set subtotal = v_subtotal,
      tax = v_tax,
      shipping_cost = v_shipping,
      shipping_rate_id = case when p_delivery_method = 'carrier' then p_shipping_rate_id end,
      shipping_km = case when p_delivery_method = 'carrier' then p_shipping_km end,
      total = v_subtotal + v_tax + v_shipping
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- 7. Anular venta (owner/admin): devuelve el stock al costo congelado y registra la devolución de
--    los cobros (monto negativo; en efectivo exige la caja abierta de quien anula).
alter table public.customer_payments drop constraint if exists customer_payments_amount_check;
alter table public.customer_payments add constraint customer_payments_amount_check check (amount <> 0);

create or replace function public.cancel_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_customer_id uuid;
  v_status text;
  v_session_id uuid;
  v_mov record;
  v_pay record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, customer_id, status into v_tenant_id, v_customer_id, v_status
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

  for v_pay in
    select method, sum(amount) as amount
    from public.customer_payments
    where sale_id = p_sale_id
    group by method
    having sum(amount) > 0
  loop
    v_session_id := null;
    if v_pay.method = 'cash' then
      select id into v_session_id from public.cash_sessions
      where tenant_id = v_tenant_id and opened_by = v_user_id and status = 'open';
      if v_session_id is null then
        raise exception 'cash_session_required' using errcode = 'P0001';
      end if;
    end if;
    insert into public.customer_payments (
      tenant_id, customer_id, sale_id, amount, paid_at, method, note, cash_session_id, created_by
    ) values (
      v_tenant_id, v_customer_id, p_sale_id, -v_pay.amount, now(), v_pay.method,
      'Devolución por anulación', v_session_id, v_user_id
    );
  end loop;

  update public.sales set status = 'cancelled', updated_at = now() where id = p_sale_id;
end;
$$;
revoke all on function public.cancel_sale(uuid) from public, anon;
grant execute on function public.cancel_sale(uuid) to authenticated;

-- 8. Caja: las ventas anuladas no cuentan.
create or replace view public.cash_session_summary as
with sale_totals as (
  select cash_session_id, count(*) as sales_count, coalesce(sum(total), 0) as sales_total
  from public.sales
  where cash_session_id is not null and status <> 'cancelled'
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

-- 9. Estado de resultados: Ventas incluye el envío cobrado; los gastos van sin IVA descontable.
create or replace view public.monthly_pnl as
with sales_monthly as (
  select
    tenant_id,
    to_char(date_trunc('month', issued_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(coalesce(total_income, 0)) as income,
    sum(coalesce(total_cogs, 0)) as cogs
  from (
    select
      s.tenant_id,
      s.issued_at,
      sum(si.qty * si.unit_price - si.discount) + coalesce(max(s.shipping_cost), 0) as total_income,
      sum(si.qty * si.unit_cost) as total_cogs
    from public.sales s
    join public.sale_items si on s.id = si.sale_id
    where s.status in ('confirmed', 'shipped', 'delivered')
    group by s.id
  ) sale_totals
  group by tenant_id, to_char(date_trunc('month', issued_at at time zone 'America/Bogota'), 'YYYY-MM')
),
expenses_monthly as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(amount - tax_amount) as expenses
  from public.expenses
  group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM')
),
payroll_monthly as (
  select
    tenant_id,
    month,
    sum(labor_cost) filter (where classification like 'costo_%') as payroll_costs,
    sum(labor_cost) filter (where classification like 'gasto_%') as payroll_expenses
  from public.monthly_payroll
  group by tenant_id, month
),
months as (
  select tenant_id, month from sales_monthly
  union select tenant_id, month from expenses_monthly
  union select tenant_id, month from payroll_monthly
)
select
  m.tenant_id,
  m.month,
  coalesce(s.income, 0)::numeric(14,2) as income,
  coalesce(s.cogs, 0)::numeric(14,2) as cogs,
  coalesce(e.expenses, 0)::numeric(14,2) as expenses,
  (coalesce(s.income, 0) - coalesce(s.cogs, 0) - coalesce(e.expenses, 0)
    - coalesce(p.payroll_costs, 0) - coalesce(p.payroll_expenses, 0))::numeric(14,2) as utility,
  coalesce(p.payroll_costs, 0)::numeric(14,2) as payroll_costs,
  coalesce(p.payroll_expenses, 0)::numeric(14,2) as payroll_expenses
from months m
left join sales_monthly s on s.tenant_id = m.tenant_id and s.month = m.month
left join expenses_monthly e on e.tenant_id = m.tenant_id and e.month = m.month
left join payroll_monthly p on p.tenant_id = m.tenant_id and p.month = m.month
where m.tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(m.tenant_id);

create or replace view public.monthly_expenses as
select
  tenant_id,
  to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
  category,
  kind,
  sum(amount - tax_amount)::numeric(14,2) as amount
from public.expenses
where tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(tenant_id)
group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM'), category, kind
union all
select
  tenant_id,
  month,
  'Nómina' as category,
  case when classification = 'gasto_variable' then 'variable' else 'fixed' end as kind,
  sum(labor_cost)::numeric(14,2) as amount
from public.monthly_payroll
where classification like 'gasto_%'
group by tenant_id, month, case when classification = 'gasto_variable' then 'variable' else 'fixed' end;

-- 10. Uso: la anulación de una venta queda registrada.
alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sale_created', 'sale_confirmed', 'sale_cancelled', 'payment_registered', 'cash_opened', 'cash_closed',
  'purchase_received', 'stock_adjusted'
));
