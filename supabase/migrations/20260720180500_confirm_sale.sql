create or replace function public.confirm_sale(
  p_sale_id uuid,
  p_warehouse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_sale record;
  v_item record;
  v_movement_id uuid;
  v_movement_cost numeric;
begin
  -- 1. Validar autenticación
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- 2. Obtener la venta y bloquearla
  select * into v_sale from public.sales where id = p_sale_id for update;

  if not found then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  -- 3. Validar tenant (el usuario pertenece al tenant de la venta)
  if not v_sale.tenant_id in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  v_tenant_id := v_sale.tenant_id;

  -- 4. Validar bodega (pertenece al mismo tenant)
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;

  -- 5. Validar estado draft
  if v_sale.status != 'draft' then
    raise exception 'sale_not_draft' using errcode = 'P0001';
  end if;

  -- 6. Procesar ítems y registrar salidas
  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    -- Registramos el movimiento. register_movement retorna el uuid.
    -- register_movement protege que el stock no baje de 0.
    v_movement_id := public.register_movement(
      p_product_id := v_item.product_id,
      p_warehouse_id := p_warehouse_id,
      p_kind := 'out',
      p_qty := v_item.qty,
      p_unit_cost := null,
      p_ref_type := 'sale',
      p_ref_id := p_sale_id::text
    );

    -- Obtener el unit_cost calculado
    select unit_cost into v_movement_cost from public.stock_movements where id = v_movement_id;

    -- Congelar el unit_cost en sale_items
    update public.sale_items
    set unit_cost = v_movement_cost
    where id = v_item.id;
  end loop;

  -- 7. Actualizar la venta
  update public.sales
  set status = 'confirmed',
      issued_at = now(),
      updated_at = now()
  where id = p_sale_id;

end;
$$;
