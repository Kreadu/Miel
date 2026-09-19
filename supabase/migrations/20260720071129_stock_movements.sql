create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  kind text not null check (kind in ('in', 'out', 'adjust', 'production_in', 'production_out')),
  qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  ref_type text,
  ref_id text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index stock_movements_tenant_id_idx on public.stock_movements (tenant_id);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_warehouse_id_idx on public.stock_movements (warehouse_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at);

alter table public.stock_movements enable row level security;
grant select on public.stock_movements to authenticated;

-- Los usuarios solo pueden ver movimientos de su tenant. No pueden insertar (escritura directa bloqueada).
create policy "stock_movements_tenant_select" on public.stock_movements for select
  using (tenant_id in (select public.user_tenant_ids()));

-- RPC para registrar movimientos atómicamente, enforcer de invariantes y cálculo de costo.
create or replace function public.register_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_kind text,
  p_qty numeric,
  p_unit_cost numeric,
  p_ref_type text default null,
  p_ref_id text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_user_id uuid;
  v_current_stock numeric := 0;
  v_total_value numeric := 0;
  v_avg_cost numeric := 0;
  v_final_qty numeric;
  v_final_cost numeric;
  v_movement_id uuid;
begin
  -- 1. Identificar usuario y tenant usando las funciones helper
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select tenant_id into v_tenant_id from public.products where id = p_product_id;
  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'Permission denied for product';
  end if;

  -- (Opcional, validar warehouse_id también)
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'Permission denied for warehouse';
  end if;

  if p_qty <= 0 and p_kind != 'adjust' then
    raise exception 'Quantity must be positive';
  end if;

  -- 2. Calcular stock actual del producto (total, no solo de esta bodega, para costo promedio)
  select coalesce(sum(qty), 0), coalesce(sum(qty * unit_cost), 0)
  into v_current_stock, v_total_value
  from public.stock_movements
  where product_id = p_product_id and tenant_id = v_tenant_id;

  if v_current_stock > 0 then
    v_avg_cost := v_total_value / v_current_stock;
  else
    v_avg_cost := coalesce(p_unit_cost, 0);
  end if;
  
  -- 3. Calcular cantidad a insertar y validar invariantes
  if p_kind in ('in', 'production_in') then
    v_final_qty := p_qty;
    v_final_cost := p_unit_cost; -- Costo dictado por la entrada
  elsif p_kind in ('out', 'production_out') then
    v_final_qty := -p_qty;
    v_final_cost := v_avg_cost; -- Congela costo promedio actual
    
    -- Validar stock no negativo en esta bodega
    declare
      v_warehouse_stock numeric;
    begin
      select coalesce(sum(qty), 0) into v_warehouse_stock
      from public.stock_movements
      where product_id = p_product_id and warehouse_id = p_warehouse_id and tenant_id = v_tenant_id;
      
      if v_warehouse_stock + v_final_qty < 0 then
        raise exception 'stock_insufficient' using errcode = 'P0001';
      end if;
    end;
  elsif p_kind = 'adjust' then
    v_final_qty := p_qty;
    if v_final_qty < 0 then
      v_final_cost := v_avg_cost;
      -- Validar stock no negativo en esta bodega
      declare
        v_warehouse_stock numeric;
      begin
        select coalesce(sum(qty), 0) into v_warehouse_stock
        from public.stock_movements
        where product_id = p_product_id and warehouse_id = p_warehouse_id and tenant_id = v_tenant_id;
        
        if v_warehouse_stock + v_final_qty < 0 then
          raise exception 'stock_insufficient' using errcode = 'P0001';
        end if;
      end;
    else
      v_final_cost := p_unit_cost;
    end if;
  else
    raise exception 'Invalid kind';
  end if;

  -- 4. Insertar movimiento
  insert into public.stock_movements (
    tenant_id, product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, created_by
  ) values (
    v_tenant_id, p_product_id, p_warehouse_id, p_kind, v_final_qty, v_final_cost, p_ref_type, p_ref_id, p_note, v_user_id
  ) returning id into v_movement_id;

  return v_movement_id;
end;
$$;
