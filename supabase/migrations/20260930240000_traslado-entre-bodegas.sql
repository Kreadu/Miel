-- S19-39 — Traslado de stock entre bodegas (para cerrar o dar de baja una) y bloqueo de dar de
-- baja una bodega con stock.

-- Sale de A y entra a B al costo de la salida, en una transacción. Solo owner/admin.
create or replace function public.transfer_stock(
  p_from uuid,
  p_to uuid,
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_to_name text;
  v_from_name text;
  v_transfer_id uuid := gen_random_uuid();
  v_item record;
  v_out_id uuid;
  v_cost numeric;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, name into v_tenant_id, v_from_name from public.warehouses where id = p_from;
  if v_tenant_id is null or not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_from = p_to then
    raise exception 'transfer_same_warehouse' using errcode = 'P0001';
  end if;

  select name into v_to_name from public.warehouses where id = p_to and tenant_id = v_tenant_id and active;
  if v_to_name is null then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  for v_item in
    select (i->>'product_id')::uuid as product_id, (i->>'qty')::numeric as qty
    from jsonb_array_elements(p_items) i
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;

    v_out_id := public.register_movement(
      p_product_id := v_item.product_id,
      p_warehouse_id := p_from,
      p_kind := 'out',
      p_qty := v_item.qty,
      p_unit_cost := null,
      p_ref_type := 'transfer',
      p_ref_id := v_transfer_id::text,
      p_note := trim(concat('Traslado a ', v_to_name, ' ', coalesce(p_note, '')))
    );
    select unit_cost into v_cost from public.stock_movements where id = v_out_id;

    perform public.register_movement(
      p_product_id := v_item.product_id,
      p_warehouse_id := p_to,
      p_kind := 'in',
      p_qty := v_item.qty,
      p_unit_cost := v_cost,
      p_ref_type := 'transfer',
      p_ref_id := v_transfer_id::text,
      p_note := trim(concat('Traslado desde ', v_from_name, ' ', coalesce(p_note, '')))
    );
  end loop;

  return v_transfer_id;
end;
$$;
revoke all on function public.transfer_stock(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.transfer_stock(uuid, uuid, jsonb, text) to authenticated;

-- Una bodega con stock no se da de baja: primero se traslada (así no queda "stock fantasma").
create or replace function public.warehouses_block_retire_with_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active and not new.active and coalesce(
    (select sum(qty) from public.stock_movements where warehouse_id = new.id), 0
  ) > 0 then
    raise exception 'warehouse_has_stock' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists warehouses_block_retire_with_stock on public.warehouses;
create trigger warehouses_block_retire_with_stock
  before update of active on public.warehouses
  for each row execute function public.warehouses_block_retire_with_stock();
