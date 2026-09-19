-- S3-03: receive_purchase — orden ordered -> received + un stock_movement 'in' por ítem,
-- todo o nada. Reusa register_movement (S2-03). Ver specs/S3-03-recepcion-compra.md.
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
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_status    text;
  v_wh_tenant uuid;
  v_item      record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  select tenant_id into v_wh_tenant
  from public.warehouses
  where id = p_warehouse_id;

  if v_wh_tenant is null or v_wh_tenant <> v_tenant_id then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;

  if v_status <> 'ordered' then
    raise exception 'purchase_not_ordered' using errcode = 'P0001';
  end if;

  for v_item in
    select product_id, qty, unit_cost
    from public.purchase_items
    where purchase_id = p_purchase_id
  loop
    perform public.register_movement(
      v_item.product_id,
      p_warehouse_id,
      'in',
      v_item.qty,
      v_item.unit_cost,
      'purchase',
      p_purchase_id::text,
      null
    );
  end loop;

  update public.purchases
  set status = 'received', received_at = now()
  where id = p_purchase_id;
end;
$$;

revoke all on function public.receive_purchase(uuid, uuid) from public, anon;
grant execute on function public.receive_purchase(uuid, uuid) to authenticated;
