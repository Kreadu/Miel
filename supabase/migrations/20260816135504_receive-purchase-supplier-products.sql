-- S15-01 — receive_purchase alimenta supplier_products al recibir una compra (upsert, misma
-- transacción atómica). create or replace forward-only: NUNCA editar
-- 20260720143947_receive-purchase.sql; este archivo copia su cuerpo íntegro y solo añade la
-- resolución de supplier_id y el upsert. Firma, validaciones y contrato de error intactos —
-- los pgTAP de S3-03/S3-04 no se tocan y deben seguir verdes.
-- Ver specs/S15-01-catalogo-por-proveedor.md.
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

  -- select distinct es obligatorio: purchase_items no tiene unique sobre (purchase_id,
  -- product_id), así que un producto repetido en dos ítems de la misma orden dispararía
  -- "ON CONFLICT DO UPDATE command cannot affect row a second time" (21000) sin el distinct,
  -- rompiendo una recepción que hoy funciona.
  -- Nota para recepción parcial futura (fuera de alcance de S15-01, hoy la RPC recibe todo o
  -- nada): si se introduce, este upsert debe moverse a solo los ítems efectivamente recibidos.
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

revoke all on function public.receive_purchase(uuid, uuid) from public, anon;
grant execute on function public.receive_purchase(uuid, uuid) to authenticated;
