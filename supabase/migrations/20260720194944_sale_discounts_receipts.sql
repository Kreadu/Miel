-- S5-08 — Descuentos por ítem (create_sale) y numeración consecutiva de recibos (confirm_sale).
-- Ver specs/S5-08-descuentos-consecutivo.md, docs/DECISIONS.md (ADR-017).
-- sale_counters: patrón "solo lectura + RPC" (mismo de stock_movements/purchases/sales) —
-- toda escritura entra por confirm_sale (security definer); sin política insert/update/delete.
create table public.sale_counters (
  tenant_id uuid primary key references public.tenants(id) on delete restrict,
  last_no integer not null default 0
);

alter table public.sale_counters enable row level security;

create policy "sale_counters_tenant_select" on public.sale_counters for select
  using (tenant_id in (select public.user_tenant_ids()));

grant select on public.sale_counters to authenticated, service_role;

-- Red de seguridad contra duplicados de recibo por tenant (drafts tienen receipt_number null,
-- por eso el índice es parcial).
create unique index sales_tenant_receipt_key
  on public.sales (tenant_id, receipt_number)
  where receipt_number is not null;

-- create_sale: ahora lee y valida el descuento por ítem (monto, precio de lista intacto) y
-- calcula subtotal/tax netos de descuento. Misma firma, mismas validaciones previas de S5-02.
create or replace function public.create_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_unit_price numeric;
  v_tax_rate numeric;
  v_discount numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers
    where id = p_customer_id and tenant_id = p_tenant_id and active
  ) then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  -- Cabecera primero (sin totales aún) para poder insertar ítems con su sale_id.
  insert into public.sales (
    tenant_id, customer_id, status, note, created_by
  ) values (
    p_tenant_id, p_customer_id, 'draft', p_note, v_user_id
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);
    v_discount := coalesce((v_item->>'discount')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_price < 0 then
      raise exception 'item_unit_price_invalid' using errcode = 'P0001';
    end if;
    if v_discount < 0 or v_discount > v_qty * v_unit_price then
      raise exception 'item_discount_invalid' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = p_tenant_id
        and active
    ) then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, qty, unit_price, discount, tax_rate
    ) values (
      p_tenant_id, v_sale_id, (v_item->>'product_id')::uuid, v_qty, v_unit_price, v_discount, v_tax_rate
    );

    v_line := v_qty * v_unit_price - v_discount;
    v_subtotal := v_subtotal + v_line;
    v_tax := v_tax + v_line * v_tax_rate / 100;
  end loop;

  update public.sales
  set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- confirm_sale: además de salidas de stock y congelamiento de costo (S5-03), asigna el
-- consecutivo de recibo del tenant. El upsert sobre sale_counters (insert ... on conflict do
-- update) es atómico a nivel de fila: serializa confirmaciones concurrentes del mismo tenant
-- sin necesidad de un lock explícito adicional; el rollback de la transacción (p. ej. por
-- stock_insufficient) revierte el incremento, garantizando la secuencia sin huecos.
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
      updated_at = now()
  where id = p_sale_id;

end;
$$;
