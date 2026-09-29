-- S19-32 — Editar el stock de cada bodega o sucursal desde el producto (Inventario). Fija la
-- cantidad objetivo por bodega y registra la diferencia como ajuste en el kardex, todo en una
-- sola transacción. Ver specs/done/S19-32-stock-por-bodega-en-producto.md. Idempotente.

create or replace function public.set_product_stock(
  p_product_id uuid,
  p_levels jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_cost numeric;
  v_level jsonb;
  v_warehouse_id uuid;
  v_target numeric;
  v_current numeric;
  v_changed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, cost into v_tenant_id, v_cost from public.products where id = p_product_id;
  -- Mismo permiso que editar el producto (products_admin_write): solo owner/admin.
  if v_tenant_id is null or not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  for v_level in select * from jsonb_array_elements(coalesce(p_levels, '[]'::jsonb)) loop
    v_warehouse_id := (v_level->>'warehouse_id')::uuid;
    v_target := (v_level->>'qty')::numeric;

    if v_target is null or v_target < 0 then
      raise exception 'stock_negative' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.warehouses where id = v_warehouse_id and tenant_id = v_tenant_id
    ) then
      raise exception 'warehouse_invalid' using errcode = 'P0001';
    end if;

    select coalesce(sum(qty), 0) into v_current
    from public.stock_movements
    where product_id = p_product_id and warehouse_id = v_warehouse_id and tenant_id = v_tenant_id;

    if v_target <> v_current then
      perform public.register_movement(
        p_product_id := p_product_id,
        p_warehouse_id := v_warehouse_id,
        p_kind := 'adjust',
        p_qty := v_target - v_current,
        p_unit_cost := v_cost,
        p_ref_type := 'product_edit'
      );
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

revoke all on function public.set_product_stock(uuid, jsonb) from public, anon;
grant execute on function public.set_product_stock(uuid, jsonb) to authenticated;
