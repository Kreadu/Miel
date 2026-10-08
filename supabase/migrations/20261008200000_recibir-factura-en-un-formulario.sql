-- S28-04 — Recibir la factura en un solo formulario: receive_purchase_invoice crea la factura con
-- los totales calculados de lo que llegó y recibe cada línea en la bodega elegida (reparto), todo
-- atómico. receive_purchase_line gana p_warehouse_id. Ver specs/S28-04-recibir-factura-en-un-formulario.md.

drop function if exists public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric);

create or replace function public.receive_purchase_line(
  p_invoice_id uuid,
  p_purchase_item_id uuid,
  p_qty numeric,
  p_unit_cost numeric default null,
  p_tax_rate numeric default null,
  p_sale_price numeric default null,
  p_warehouse_id uuid default null
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
  v_wh uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;
  if v_inv.voided_at is not null then
    raise exception 'invoice_voided' using errcode = 'P0001';
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
  -- S26-11: entra en la bodega del ítem; los ítems viejos, en la de la factura.
  v_wh := coalesce(p_warehouse_id, v_item.warehouse_id, v_inv.warehouse_id);
  if v_wh is null or (p_warehouse_id is not null and not exists (
    select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_inv.tenant_id and active
  )) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
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
    v_item.product_id, v_wh, 'in', p_qty, v_cost,
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
revoke all on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric, uuid) from public, anon;
grant execute on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric, uuid) to authenticated;

create or replace function public.receive_purchase_invoice(
  p_purchase_id uuid,
  p_number text,
  p_issued_on date,
  p_due_on date,
  p_cufe text,
  p_file_path text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_supplier_id uuid;
  v_status text;
  v_invoice_id uuid;
  v_line jsonb;
  v_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, supplier_id, status into v_tenant_id, v_supplier_id, v_status
  from public.purchases where id = p_purchase_id for update;
  if v_tenant_id is null or v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_number), '') = '' or p_issued_on is null then
    raise exception 'invoice_invalid' using errcode = 'P0001';
  end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> v_tenant_id::text then
    raise exception 'invoice_file_invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.purchase_invoices
    where tenant_id = v_tenant_id and supplier_id = v_supplier_id and voided_at is null
      and lower(btrim(number)) = lower(btrim(p_number))
  ) then
    raise exception 'invoice_number_taken' using errcode = 'P0001';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or not exists (select 1 from jsonb_array_elements(p_lines) l where coalesce((l->>'qty')::numeric, 0) > 0) then
    raise exception 'lines_required' using errcode = 'P0001';
  end if;

  insert into public.purchase_invoices (
    tenant_id, purchase_id, supplier_id, number, issued_on, due_on, cufe, subtotal, tax, total, warehouse_id, file_path
  ) values (
    v_tenant_id, p_purchase_id, v_supplier_id, btrim(p_number), p_issued_on, p_due_on, nullif(btrim(p_cufe), ''),
    0, 0, 0, null, p_file_path
  ) returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    continue when coalesce((v_line->>'qty')::numeric, 0) <= 0;
    perform public.receive_purchase_line(
      v_invoice_id,
      (v_line->>'purchase_item_id')::uuid,
      (v_line->>'qty')::numeric,
      nullif(v_line->>'unit_cost', '')::numeric,
      nullif(v_line->>'tax_rate', '')::numeric,
      nullif(v_line->>'sale_price', '')::numeric,
      nullif(v_line->>'warehouse_id', '')::uuid
    );
    v_count := v_count + 1;
  end loop;

  -- Totales de la factura = lo que llegó (IVA redondeado por línea, como create_purchase).
  update public.purchase_invoices i
  set subtotal = k.subtotal, tax = k.tax, total = k.subtotal + k.tax
  from (
    select coalesce(sum(round(qty * unit_cost, 2)), 0) as subtotal,
           coalesce(sum(round(round(qty * unit_cost, 2) * tax_rate / 100, 2)), 0) as tax
    from public.purchase_receipt_lines where invoice_id = v_invoice_id and voided_at is null
  ) k
  where i.id = v_invoice_id;

  perform public.refresh_purchase_invoiced_total(p_purchase_id);
  return v_invoice_id;
end;
$$;
revoke all on function public.receive_purchase_invoice(uuid, text, date, date, text, text, jsonb) from public, anon;
grant execute on function public.receive_purchase_invoice(uuid, text, date, date, text, text, jsonb) to authenticated;
