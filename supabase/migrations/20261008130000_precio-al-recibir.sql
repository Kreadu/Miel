-- S28-02 — Al recibir con otro costo, el precio de venta mantiene el mismo % sobre el costo (P1) o
-- toma el que escribe el dueño/admin; historial de precios por proveedor y producto (P3, sin tabla
-- nueva). Ver specs/S28-02-precio-de-venta-e-historial-proveedor.md.

drop function if exists public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric);

create or replace function public.receive_purchase_line(
  p_invoice_id uuid,
  p_purchase_item_id uuid,
  p_qty numeric,
  p_unit_cost numeric default null,
  p_tax_rate numeric default null,
  p_sale_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_item record;
  v_status text;
  v_is_admin boolean;
  v_cost numeric;
  v_tax numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_price numeric;
  v_movement_id uuid;
  v_line_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  select * into v_item from public.purchase_items
  where id = p_purchase_item_id and purchase_id = v_inv.purchase_id;
  if v_item.id is null then
    raise exception 'item_invalid' using errcode = 'P0001';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty_invalid' using errcode = 'P0001';
  end if;
  if v_item.received_qty + p_qty > v_item.qty then
    raise exception 'qty_exceeds_pending' using errcode = 'P0001';
  end if;

  v_is_admin := public.user_is_tenant_admin(v_inv.tenant_id);
  if v_is_admin then
    if p_unit_cost is null or p_unit_cost < 0 or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
      raise exception 'cost_invalid' using errcode = 'P0001';
    end if;
    if p_sale_price is not null and p_sale_price < 0 then
      raise exception 'price_invalid' using errcode = 'P0001';
    end if;
    v_cost := round(p_unit_cost, 2);
    v_tax := p_tax_rate;
  else
    v_cost := v_item.unit_cost;
    v_tax := v_item.tax_rate;
  end if;

  select cost, price into v_old_cost, v_price from public.products where id = v_item.product_id for update;

  v_movement_id := public.register_movement(
    v_item.product_id, v_inv.warehouse_id, 'in', p_qty, v_cost,
    'purchase', v_inv.purchase_id::text, 'Factura ' || v_inv.number
  );

  -- P1: mismo % sobre el costo; el dueño/admin puede fijar otro precio.
  select cost into v_new_cost from public.products where id = v_item.product_id;
  if v_is_admin and p_sale_price is not null then
    update public.products set price = round(p_sale_price, 0) where id = v_item.product_id;
  elsif coalesce(v_old_cost, 0) > 0 and coalesce(v_price, 0) > 0 and v_new_cost is distinct from v_old_cost then
    update public.products set price = round(v_price * v_new_cost / v_old_cost, 0) where id = v_item.product_id;
  end if;

  insert into public.purchase_receipt_lines (
    tenant_id, invoice_id, purchase_item_id, product_id, qty, unit_cost, tax_rate, movement_id
  ) values (
    v_inv.tenant_id, p_invoice_id, p_purchase_item_id, v_item.product_id, p_qty, v_cost, v_tax, v_movement_id
  ) returning id into v_line_id;

  update public.purchase_items set received_qty = received_qty + p_qty where id = p_purchase_item_id;

  insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
  values (v_inv.tenant_id, v_inv.supplier_id, v_item.product_id, now())
  on conflict (supplier_id, product_id) do update set last_purchased_at = excluded.last_purchased_at;

  perform public.refresh_purchase_reception(v_inv.purchase_id);
  return v_line_id;
end;
$$;
revoke all on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric) to authenticated;

-- P3: historial = líneas no anuladas. security_invoker: hereda la RLS dueño/admin de S28-01.
create view public.supplier_price_history with (security_invoker = true) as
select
  h.*,
  case when h.prev_cost > 0 then round((h.unit_cost - h.prev_cost) / h.prev_cost * 100, 2) end as change_percent
from (
  select
    l.id as line_id,
    l.tenant_id,
    i.supplier_id,
    s.name as supplier_name,
    l.product_id,
    p.name as product_name,
    i.number as invoice_number,
    i.issued_on,
    l.qty,
    l.unit_cost,
    l.created_at,
    lag(l.unit_cost) over (partition by i.supplier_id, l.product_id order by i.issued_on, l.created_at) as prev_cost
  from public.purchase_receipt_lines l
  join public.purchase_invoices i on i.id = l.invoice_id
  join public.suppliers s on s.id = i.supplier_id
  join public.products p on p.id = l.product_id
  where l.voided_at is null
) h;
grant select on public.supplier_price_history to authenticated;
