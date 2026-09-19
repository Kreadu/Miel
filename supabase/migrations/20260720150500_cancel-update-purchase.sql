-- S3-04: Cancelación y edición de compra: cancel_purchase, update_purchase
-- Ver specs/S3-04-cancelacion-compra.md.

-- cancel_purchase: transiciona una orden draft u ordered a cancelled.
create or replace function public.cancel_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status in ('received', 'cancelled') then
    raise exception 'purchase_not_cancellable' using errcode = 'P0001';
  end if;

  update public.purchases
  set status = 'cancelled'
  where id = p_purchase_id;
end;
$$;

revoke all on function public.cancel_purchase(uuid) from public, anon;
grant execute on function public.cancel_purchase(uuid) to authenticated;

-- update_purchase: edita una orden draft u ordered reemplazando items y totales.
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

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status not in ('draft', 'ordered') then
    raise exception 'purchase_not_updatable' using errcode = 'P0001';
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

  -- Delete existing items
  delete from public.purchase_items
  where purchase_id = p_purchase_id;

  -- Insert new items
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

  -- Update header
  update public.purchases
  set supplier_id = p_supplier_id,
      note = p_note,
      subtotal = v_subtotal,
      tax = v_tax,
      total = v_subtotal + v_tax
  where id = p_purchase_id;
end;
$$;

revoke all on function public.update_purchase(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.update_purchase(uuid, uuid, jsonb, text) to authenticated;
