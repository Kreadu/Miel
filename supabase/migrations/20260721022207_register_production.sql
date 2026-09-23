-- S6-02 — Producción: registrar producción atómica y calcular costo.
-- Ver specs/S6-02-registro-produccion.md

create or replace function public.register_production(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_output_qty numeric,
  p_consumptions jsonb
) returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_product_kind text;
  v_production_id text;
  v_total_cost numeric := 0;
  v_item record;
  v_movement_id uuid;
  v_item_cost numeric;
begin
  -- Authenticate and check tenant
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  -- Validate warehouse belongs to tenant
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = p_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  -- Validate product is 'finished'
  select kind into v_product_kind from public.products where id = p_product_id and tenant_id = p_tenant_id;
  if v_product_kind is null then
    raise exception 'product_not_found' using errcode = 'P0001';
  end if;
  if v_product_kind != 'finished' then
    raise exception 'product_not_finished' using errcode = 'P0001';
  end if;

  -- Validate output quantity
  if p_output_qty <= 0 then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  -- Validate consumptions
  if jsonb_array_length(p_consumptions) = 0 then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  -- Generate a reference ID for this production batch
  v_production_id := gen_random_uuid()::text;

  -- Process consumptions
  for v_item in select * from jsonb_to_recordset(p_consumptions) as x(product_id uuid, qty numeric) loop
    if v_item.qty <= 0 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;

    -- Call register_movement for out
    v_movement_id := public.register_movement(
      v_item.product_id,
      p_warehouse_id,
      'production_out',
      v_item.qty,
      0, 
      'production_consumption',
      v_production_id,
      'Consumo para producción'
    );

    -- Get the actual cost used for this consumption
    select unit_cost into v_item_cost from public.stock_movements where id = v_movement_id;
    
    v_total_cost := v_total_cost + (v_item_cost * v_item.qty);
  end loop;

  -- Process output
  declare
    v_unit_cost numeric;
    v_total_qty numeric;
    v_total_val numeric;
    v_new_avg numeric;
  begin
    v_unit_cost := v_total_cost / p_output_qty;
    
    -- Call register_movement for in
    perform public.register_movement(
      p_product_id,
      p_warehouse_id,
      'production_in',
      p_output_qty,
      v_unit_cost,
      'production_output',
      v_production_id,
      'Entrada de producción'
    );

    -- Update the cost of the finished product in the catalog
    select coalesce(sum(qty), 0), coalesce(sum(qty * unit_cost), 0)
    into v_total_qty, v_total_val
    from public.stock_movements
    where product_id = p_product_id and tenant_id = p_tenant_id;

    if v_total_qty > 0 then
      v_new_avg := v_total_val / v_total_qty;
    else
      v_new_avg := v_unit_cost;
    end if;

    update public.products
    set cost = v_new_avg
    where id = p_product_id and tenant_id = p_tenant_id;
  end;
end;
$$;
