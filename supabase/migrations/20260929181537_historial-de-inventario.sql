-- S19-34 — Historial de un inventario por bodega o sucursal y rango de fechas: ítems con
-- movimiento en el rango, con su stock al final del rango, costo y precio de venta.
-- Ver specs/done/S19-34-historial-y-porcentaje-de-venta.md. Idempotente.
--
-- security invoker: RLS de stock_movements/warehouses y la vista products_catalog (que enmascara
-- el costo a member) aplican como en cualquier consulta del usuario. Fechas en hora de Bogotá.

create or replace function public.inventory_history(
  p_inventory text,
  p_from date,
  p_to date,
  p_warehouse_id uuid default null
)
returns table (
  warehouse_id uuid,
  warehouse_name text,
  product_id uuid,
  sku text,
  product_name text,
  unit text,
  stock numeric,
  cost numeric,
  price numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.warehouse_id,
    w.name,
    pc.id,
    pc.sku,
    pc.name,
    pc.unit,
    sum(m.qty),
    pc.cost,
    pc.price
  from public.stock_movements m
  join public.products_catalog pc on pc.id = m.product_id
  join public.warehouses w on w.id = m.warehouse_id
  where m.tenant_id in (select public.user_tenant_ids())
    and pc.inventory = p_inventory
    and (p_warehouse_id is null or m.warehouse_id = p_warehouse_id)
    and m.created_at < ((p_to + 1)::timestamp at time zone 'America/Bogota')
  group by m.warehouse_id, w.name, pc.id, pc.sku, pc.name, pc.unit, pc.cost, pc.price
  having bool_or(m.created_at >= (p_from::timestamp at time zone 'America/Bogota'))
  order by w.name, pc.name
$$;

revoke all on function public.inventory_history(text, date, date, uuid) from public, anon;
grant execute on function public.inventory_history(text, date, date, uuid) to authenticated;
