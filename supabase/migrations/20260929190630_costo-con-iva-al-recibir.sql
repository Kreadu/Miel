-- S19-37 — Al recibir una orden de compra, el costo del producto pasa a ser el costo unitario
-- con IVA (y ese es el costo que entra al kardex). Misma firma: create or replace alcanza.
-- Copia de la versión de S15-01 (20260816135504) + costo con IVA.
-- Ver specs/done/S19-37-hoja-de-compra.md. Idempotente.

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

  -- S19-37: el costo que entra al kardex es el costo unitario con IVA.
  for v_item in
    select product_id, qty, round(unit_cost * (1 + tax_rate / 100), 2) as unit_cost_with_tax
    from public.purchase_items
    where purchase_id = p_purchase_id
  loop
    perform public.register_movement(
      v_item.product_id,
      p_warehouse_id,
      'in',
      v_item.qty,
      v_item.unit_cost_with_tax,
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

  -- S19-37: el costo del producto pasa a ser el costo unitario con IVA de esta compra (sobre
  -- ese costo se aplica el % de venta). Producto repetido en la orden: promedio ponderado.
  update public.products p
  set cost = c.unit_cost_with_tax
  from (
    select
      product_id,
      round(sum(qty * unit_cost * (1 + tax_rate / 100)) / sum(qty), 2) as unit_cost_with_tax
    from public.purchase_items
    where purchase_id = p_purchase_id
    group by product_id
  ) c
  where p.id = c.product_id;

  update public.purchases
  set status = 'received', received_at = now()
  where id = p_purchase_id;
end;
$$;
revoke all on function public.receive_purchase(uuid, uuid) from public, anon;
grant execute on function public.receive_purchase(uuid, uuid) to authenticated;
