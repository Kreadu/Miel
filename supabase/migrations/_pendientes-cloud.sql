-- Pegar completo en Supabase → SQL Editor del proyecto (cloud) y ejecutar UNA vez.
-- S26-10 + S26-11 + S26-12. Borrar este archivo después de aplicarlo.
begin;
-- S26-10 — Una orden aprobada y enviada no se edita: las diferencias de cantidad o precio se
-- registran al recibir, con la factura del proveedor (S28). Antes de enviarla, solo la edita el
-- dueño o un aprobador asignado (queda aprobada por él). Ver specs/S26-10-orden-enviada-no-se-edita.md.

create or replace function public.update_purchase(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_sup_tenant uuid;
  v_name text;
  v_item jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  -- Solo el dueño o un aprobador asignado edita, y solo antes de aprobarla y enviarla.
  if not public.user_can_approve_purchases(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status <> 'draft' then
    raise exception 'purchase_not_updatable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.supplier_payments where purchase_id = p_purchase_id) then
    raise exception 'purchase_has_payments' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  select tenant_id into v_sup_tenant
  from public.suppliers
  where id = p_supplier_id and active;

  if v_sup_tenant is null or v_sup_tenant <> v_tenant_id then
    raise exception 'supplier_invalid' using errcode = 'P0001';
  end if;

  v_name := public.my_display_name(v_tenant_id);

  delete from public.purchase_items
  where purchase_id = p_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_cost < 0 then
      raise exception 'item_unit_cost_invalid' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = v_tenant_id
        and active
    ) then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    insert into public.purchase_items (
      tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate
    ) values (
      v_tenant_id, p_purchase_id, (v_item->>'product_id')::uuid, v_qty, v_unit_cost, v_tax_rate
    );

    v_subtotal := v_subtotal + v_qty * v_unit_cost;
    v_tax := v_tax + v_qty * v_unit_cost * v_tax_rate / 100;
  end loop;

  update public.purchases
  set supplier_id = p_supplier_id,
      note = p_note,
      subtotal = v_subtotal,
      tax = v_tax,
      total = v_subtotal + v_tax,
      approved_by = auth.uid(),
      approved_by_name = v_name,
      approved_at = now()
  where id = p_purchase_id;
end;
$$;

-- S26-11 — Orden de compra con cantidades por bodega: cada ítem puede tener su bodega; al recibir,
-- el stock entra en la bodega del ítem (la factura ya no la necesita, salvo ítems viejos sin bodega)
-- y anular una línea saca el stock de donde entró. Ver specs/S26-11-cantidades-por-bodega.md.

alter table public.purchase_items
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete restrict;
create index if not exists purchase_items_warehouse_id_idx on public.purchase_items (warehouse_id);

alter table public.purchase_invoices alter column warehouse_id drop not null;

create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_status text,
  p_items jsonb,
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
  v_purchase_id uuid;
  v_name text;
  v_can_approve boolean;
  v_item jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_wh uuid;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id into v_tenant_id
  from public.suppliers
  where id = p_supplier_id and active;
  if v_tenant_id is null then
    raise exception 'supplier_invalid' using errcode = 'P0001';
  end if;

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_status not in ('draft', 'ordered') then
    raise exception 'status_invalid' using errcode = 'P0001';
  end if;

  v_can_approve := public.user_can_approve_purchases(v_tenant_id);
  if p_status = 'ordered' and not v_can_approve then
    raise exception 'approval_required' using errcode = 'P0001';
  end if;

  v_name := public.my_display_name(v_tenant_id);

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  insert into public.purchases (
    tenant_id, supplier_id, status, issued_at, note, created_by,
    requested_by_name, requested_at, approved_by, approved_by_name, approved_at, ordered_by_name
  ) values (
    v_tenant_id, p_supplier_id, p_status,
    case when p_status = 'ordered' then now() else null end,
    p_note, v_user_id,
    v_name, now(),
    case when v_can_approve then v_user_id end,
    case when v_can_approve then v_name end,
    case when v_can_approve then now() end,
    case when p_status = 'ordered' then v_name end
  ) returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_cost < 0 then
      raise exception 'item_unit_cost_invalid' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = v_tenant_id
        and active
    ) then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    -- S26-11: bodega del ítem (opcional), activa y de la empresa.
    v_wh := nullif(v_item->>'warehouse_id', '')::uuid;
    if v_wh is not null and not exists (
      select 1 from public.warehouses where id = v_wh and tenant_id = v_tenant_id and active
    ) then
      raise exception 'warehouse_invalid' using errcode = 'P0001';
    end if;

    insert into public.purchase_items (
      tenant_id, purchase_id, product_id, warehouse_id, qty, unit_cost, tax_rate
    ) values (
      v_tenant_id, v_purchase_id, (v_item->>'product_id')::uuid, v_wh, v_qty, v_unit_cost, v_tax_rate
    );

    v_subtotal := v_subtotal + v_qty * v_unit_cost;
    v_tax := v_tax + v_qty * v_unit_cost * v_tax_rate / 100;
  end loop;

  update public.purchases
  set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax
  where id = v_purchase_id;

  return v_purchase_id;
end;
$$;

create or replace function public.update_purchase(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_sup_tenant uuid;
  v_name text;
  v_item jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_wh uuid;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  -- Solo el dueño o un aprobador asignado edita, y solo antes de aprobarla y enviarla.
  if not public.user_can_approve_purchases(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status <> 'draft' then
    raise exception 'purchase_not_updatable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.supplier_payments where purchase_id = p_purchase_id) then
    raise exception 'purchase_has_payments' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  select tenant_id into v_sup_tenant
  from public.suppliers
  where id = p_supplier_id and active;

  if v_sup_tenant is null or v_sup_tenant <> v_tenant_id then
    raise exception 'supplier_invalid' using errcode = 'P0001';
  end if;

  v_name := public.my_display_name(v_tenant_id);

  delete from public.purchase_items
  where purchase_id = p_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_cost < 0 then
      raise exception 'item_unit_cost_invalid' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = v_tenant_id
        and active
    ) then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    -- S26-11: bodega del ítem (opcional), activa y de la empresa.
    v_wh := nullif(v_item->>'warehouse_id', '')::uuid;
    if v_wh is not null and not exists (
      select 1 from public.warehouses where id = v_wh and tenant_id = v_tenant_id and active
    ) then
      raise exception 'warehouse_invalid' using errcode = 'P0001';
    end if;

    insert into public.purchase_items (
      tenant_id, purchase_id, product_id, warehouse_id, qty, unit_cost, tax_rate
    ) values (
      v_tenant_id, p_purchase_id, (v_item->>'product_id')::uuid, v_wh, v_qty, v_unit_cost, v_tax_rate
    );

    v_subtotal := v_subtotal + v_qty * v_unit_cost;
    v_tax := v_tax + v_qty * v_unit_cost * v_tax_rate / 100;
  end loop;

  update public.purchases
  set supplier_id = p_supplier_id,
      note = p_note,
      subtotal = v_subtotal,
      tax = v_tax,
      total = v_subtotal + v_tax,
      approved_by = auth.uid(),
      approved_by_name = v_name,
      approved_at = now()
  where id = p_purchase_id;
end;
$$;

create or replace function public.create_purchase_invoice(
  p_purchase_id uuid,
  p_number text,
  p_issued_on date,
  p_due_on date,
  p_cufe text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_warehouse_id uuid,
  p_file_path text
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
  v_id uuid;
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
  -- S26-11: con bodega por ítem la factura no la necesita; solo si hay ítems viejos sin bodega.
  if p_warehouse_id is null then
    if exists (select 1 from public.purchase_items where purchase_id = p_purchase_id and warehouse_id is null) then
      raise exception 'warehouse_invalid' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_number), '') = '' or p_issued_on is null then
    raise exception 'invoice_invalid' using errcode = 'P0001';
  end if;
  if p_subtotal is null or p_tax is null or p_total is null
     or p_subtotal < 0 or p_tax < 0 or p_total <> p_subtotal + p_tax then
    raise exception 'invoice_totals_invalid' using errcode = 'P0001';
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

  insert into public.purchase_invoices (
    tenant_id, purchase_id, supplier_id, number, issued_on, due_on, cufe, subtotal, tax, total, warehouse_id, file_path
  ) values (
    v_tenant_id, p_purchase_id, v_supplier_id, btrim(p_number), p_issued_on, p_due_on, nullif(btrim(p_cufe), ''),
    p_subtotal, p_tax, p_total, p_warehouse_id, p_file_path
  ) returning id into v_id;

  perform public.refresh_purchase_invoiced_total(p_purchase_id);
  return v_id;
end;
$$;

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
  v_wh := coalesce(v_item.warehouse_id, v_inv.warehouse_id);
  if v_wh is null then
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

create or replace function public.void_purchase_receipt_line(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_inv record;
  v_status text;
  v_wh_stock numeric;
  v_qty numeric;
  v_value numeric;
  v_exit_cost numeric;
  v_wh uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_line from public.purchase_receipt_lines where id = p_line_id for update;
  if v_line.id is null or v_line.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'line_not_found' using errcode = 'P0001';
  end if;
  if not public.user_is_tenant_admin(v_line.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_line.voided_at is not null then
    raise exception 'line_already_voided' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = v_line.invoice_id;
  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status = 'cancelled' then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  -- S26-11: sale de la bodega donde entró (la del movimiento de la línea).
  select warehouse_id into v_wh from public.stock_movements where id = v_line.movement_id;
  perform 1 from public.products where id = v_line.product_id for update;
  select coalesce(sum(qty), 0) into v_wh_stock from public.stock_movements
  where product_id = v_line.product_id and warehouse_id = v_wh;
  if v_wh_stock < v_line.qty then
    raise exception 'stock_insufficient' using errcode = 'P0001';
  end if;

  select coalesce(sum(qty), 0), coalesce(sum(qty * unit_cost), 0) into v_qty, v_value
  from public.stock_movements where product_id = v_line.product_id;

  v_exit_cost := v_line.unit_cost;
  if v_qty - v_line.qty <= 0 then
    v_exit_cost := round(v_value / v_line.qty, 2);
  elsif v_value - v_line.qty * v_exit_cost < 0 then
    v_exit_cost := round(v_value / v_qty, 2);
  end if;

  insert into public.stock_movements (
    tenant_id, product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, created_by
  ) values (
    v_line.tenant_id, v_line.product_id, v_wh, 'out', -v_line.qty, v_exit_cost,
    'purchase', v_inv.purchase_id::text, 'Anulación factura ' || v_inv.number, auth.uid()
  );

  -- Costo promedio sin esa entrada (mismo cálculo que register_movement).
  update public.products p
  set cost = round(k.value / k.qty, 2)
  from (
    select sum(qty) as qty, sum(qty * unit_cost) as value
    from public.stock_movements where product_id = v_line.product_id
  ) k
  where p.id = v_line.product_id and k.qty > 0;

  update public.purchase_receipt_lines set voided_at = now(), voided_by = auth.uid() where id = p_line_id;
  update public.purchase_items set received_qty = received_qty - v_line.qty where id = v_line.purchase_item_id;
  perform public.refresh_purchase_reception(v_inv.purchase_id);
end;
$$;

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
    select product_id, warehouse_id, qty, unit_cost from public.purchase_items where purchase_id = p_purchase_id
  loop
    perform public.register_movement(
      v_item.product_id, coalesce(v_item.warehouse_id, p_warehouse_id), 'in', v_item.qty, v_item.unit_cost,
      'purchase', p_purchase_id::text, null
    );
  end loop;

  update public.purchase_items set received_qty = qty where purchase_id = p_purchase_id;

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

-- S26-12 — Conectar mi ficha de RRHH con mi cuenta: si quien invita escribe su propio correo en
-- "Acceso con correo", la app llama a esta RPC en vez de invitar. Ver specs/S26-12-conectar-mi-ficha.md.
create or replace function public.link_worker_to_me(p_worker_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker record;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_worker from public.workers where id = p_worker_id for update;
  if v_worker.id is null or not public.user_is_tenant_admin(v_worker.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_worker.user_id is not null and v_worker.user_id <> auth.uid() then
    raise exception 'worker_linked' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.workers
    where tenant_id = v_worker.tenant_id and user_id = auth.uid() and id <> p_worker_id
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  -- El trigger workers_sync_account (S26-08) copia el nombre a la membresía.
  update public.workers
  set user_id = auth.uid(), email = coalesce(nullif(btrim(email), ''), v_email)
  where id = p_worker_id;

  delete from public.invitations
  where tenant_id = v_worker.tenant_id and lower(email) = lower(v_email) and accepted_at is null;
end;
$$;
revoke all on function public.link_worker_to_me(uuid) from public, anon;
grant execute on function public.link_worker_to_me(uuid) to authenticated;

commit;
