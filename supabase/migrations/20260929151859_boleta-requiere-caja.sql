-- S19-22 — La boleta (confirm_sale) de productos que se venden en tienda exige caja abierta.
-- Ver specs/done/S19-22-boleta-requiere-caja.md. Misma firma: create or replace alcanza.
-- Copia de la versión de S5-08 (20260720194944) + paso 5b + liga la venta a la caja.

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
  v_receipt_number integer;
  v_session_id uuid;
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

  -- 5b. S19-22: productos que se venden en tienda ('in_store'/'both') exigen la caja abierta
  -- de quien genera la boleta. El pedido (draft) se crea sin caja; la boleta, no.
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

  -- 7. Asignar el consecutivo de recibo del tenant (atómico: insert...on conflict do update)
  insert into public.sale_counters as c (tenant_id, last_no)
  values (v_tenant_id, 1)
  on conflict (tenant_id) do update set last_no = c.last_no + 1
  returning c.last_no into v_receipt_number;

  -- 8. Actualizar la venta
  update public.sales
  set status = 'confirmed',
      issued_at = now(),
      receipt_number = v_receipt_number,
      cash_session_id = coalesce(cash_session_id, v_session_id),
      updated_at = now()
  where id = p_sale_id;

end;
$$;
