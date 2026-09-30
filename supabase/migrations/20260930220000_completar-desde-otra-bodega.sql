-- S18-10 — Una venta puede salir de varias bodegas: la de la venta y las que el dueño marque como
-- "presta stock". confirm_sale queda igual por fuera (todo de una bodega), ahora sobre el reparto.

alter table public.warehouses
  add column if not exists lends_stock boolean not null default false;

-- Columnas escribibles por la app (S19-25 usa grants por columna).
grant insert (lends_stock) on public.warehouses to authenticated;
grant update (lends_stock) on public.warehouses to authenticated;

-- Confirmar con reparto [{product_id, warehouse_id, qty}]: cada producto suma exactamente lo
-- vendido; otra bodega distinta de la de la venta debe prestar stock. Misma boleta, caja y
-- congelado de costo que confirm_sale (S19-22, S23-01).
create or replace function public.confirm_sale_allocated(
  p_sale_id uuid,
  p_warehouse_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_tenant_id uuid;
  v_session_id uuid;
  v_alloc record;
  v_movement_id uuid;
  v_receipt_number integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  v_tenant_id := v_sale.tenant_id;

  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;

  if v_sale.status <> 'draft' then
    raise exception 'sale_not_draft' using errcode = 'P0001';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'allocation_mismatch' using errcode = 'P0001';
  end if;

  -- Cada parte: cantidad > 0 y bodega de la empresa (la de la venta, o una que preste stock).
  for v_alloc in
    select (a->>'product_id')::uuid as product_id, (a->>'warehouse_id')::uuid as warehouse_id,
           (a->>'qty')::numeric as qty
    from jsonb_array_elements(p_allocations) a
  loop
    if v_alloc.qty is null or v_alloc.qty <= 0 then
      raise exception 'allocation_mismatch' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.warehouses
                   where id = v_alloc.warehouse_id and tenant_id = v_tenant_id and active) then
      raise exception 'warehouse_invalid' using errcode = 'P0001';
    end if;
    if v_alloc.warehouse_id <> p_warehouse_id and not exists (
      select 1 from public.warehouses where id = v_alloc.warehouse_id and lends_stock
    ) then
      raise exception 'warehouse_not_lending' using errcode = 'P0001';
    end if;
  end loop;

  -- El reparto suma exactamente lo vendido de cada producto (ni más ni menos, ni productos ajenos).
  if exists (
    select 1
    from (select product_id, sum(qty) as qty from public.sale_items where sale_id = p_sale_id group by product_id) s
    full join (
      select (a->>'product_id')::uuid as product_id, sum((a->>'qty')::numeric) as qty
      from jsonb_array_elements(p_allocations) a group by 1
    ) a on a.product_id = s.product_id
    where s.qty is distinct from a.qty
  ) then
    raise exception 'allocation_mismatch' using errcode = 'P0001';
  end if;

  -- S19-22: productos que se venden en tienda exigen la caja abierta de quien genera la boleta.
  if exists (
    select 1 from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = p_sale_id and p.sales_channel in ('in_store', 'both')
  ) then
    select id into v_session_id from public.cash_sessions
    where tenant_id = v_tenant_id and opened_by = auth.uid() and status = 'open';
    if v_session_id is null then
      raise exception 'cash_session_required' using errcode = 'P0001';
    end if;
  end if;

  -- Una salida por parte (register_movement valida el stock de cada bodega).
  for v_alloc in
    select (a->>'product_id')::uuid as product_id, (a->>'warehouse_id')::uuid as warehouse_id,
           (a->>'qty')::numeric as qty
    from jsonb_array_elements(p_allocations) a
  loop
    v_movement_id := public.register_movement(
      p_product_id := v_alloc.product_id,
      p_warehouse_id := v_alloc.warehouse_id,
      p_kind := 'out',
      p_qty := v_alloc.qty,
      p_unit_cost := null,
      p_ref_type := 'sale',
      p_ref_id := p_sale_id::text
    );
  end loop;

  -- Costo congelado de cada ítem: promedio ponderado de sus salidas (S23-01).
  update public.sale_items si
  set unit_cost = m.unit_cost
  from (
    select product_id, sum(-qty * unit_cost) / nullif(sum(-qty), 0) as unit_cost
    from public.stock_movements
    where ref_type = 'sale' and ref_id = p_sale_id::text and qty < 0
    group by product_id
  ) m
  where si.sale_id = p_sale_id and si.product_id = m.product_id;

  insert into public.sale_counters as c (tenant_id, last_no)
  values (v_tenant_id, 1)
  on conflict (tenant_id) do update set last_no = c.last_no + 1
  returning c.last_no into v_receipt_number;

  update public.sales
  set status = 'confirmed',
      issued_at = now(),
      receipt_number = v_receipt_number,
      cash_session_id = coalesce(cash_session_id, v_session_id),
      updated_at = now()
  where id = p_sale_id;
end;
$$;
revoke all on function public.confirm_sale_allocated(uuid, uuid, jsonb) from public, anon;
grant execute on function public.confirm_sale_allocated(uuid, uuid, jsonb) to authenticated;

-- confirm_sale de siempre = todo de una bodega (la bodega de la venta no necesita prestar stock).
create or replace function public.confirm_sale(p_sale_id uuid, p_warehouse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.confirm_sale_allocated(
    p_sale_id,
    p_warehouse_id,
    (select jsonb_agg(jsonb_build_object('product_id', product_id, 'warehouse_id', p_warehouse_id, 'qty', qty))
     from (select product_id, sum(qty) as qty from public.sale_items where sale_id = p_sale_id group by product_id) s)
  );
end;
$$;

-- Cobrar y entregar (S18-06) con reparto opcional.
drop function if exists public.checkout_counter_sale(uuid, jsonb, uuid, text, uuid, text, text);
create or replace function public.checkout_counter_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid,
  p_payment_method text,
  p_warehouse_id uuid,
  p_document_type text default 'boleta',
  p_note text default null,
  p_allocations jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = 'P0001';
  end if;

  if p_document_type is null or p_document_type not in ('boleta', 'factura') then
    raise exception 'document_type_invalid' using errcode = 'P0001';
  end if;

  if p_customer_id is null then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;

  if p_document_type = 'factura' and not exists (
    select 1 from public.customers
    where id = p_customer_id and tenant_id = p_tenant_id
      and not is_generic and coalesce(trim(doc_number), '') <> ''
  ) then
    raise exception 'invoice_customer_required' using errcode = 'P0001';
  end if;

  v_sale_id := public.create_sale(
    p_tenant_id := p_tenant_id,
    p_items := p_items,
    p_customer_id := p_customer_id,
    p_note := p_note,
    p_payment_method := p_payment_method,
    p_delivery_method := 'pickup'
  );

  update public.sales set document_type = p_document_type where id = v_sale_id;

  if p_allocations is null then
    perform public.confirm_sale(v_sale_id, p_warehouse_id);
  else
    perform public.confirm_sale_allocated(v_sale_id, p_warehouse_id, p_allocations);
  end if;

  select total into v_total from public.sales where id = v_sale_id;
  if v_total > 0 then
    perform public.register_customer_payment(p_customer_id, v_sale_id, v_total, p_payment_method, now(), null);
  end if;

  perform public.mark_sale_delivered(v_sale_id);

  return v_sale_id;
end;
$$;
revoke all on function public.checkout_counter_sale(uuid, jsonb, uuid, text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.checkout_counter_sale(uuid, jsonb, uuid, text, uuid, text, text, jsonb) to authenticated;
