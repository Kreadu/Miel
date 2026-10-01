-- S19-40 — Un producto agotado siempre avisa (aunque su mínimo sea 0), si alguna vez tuvo stock.
create or replace view public.low_stock_alerts as
with stock_por_producto as (
  select tenant_id, product_id, sum(qty) as total_qty
  from public.stock_movements
  where tenant_id in (select public.user_tenant_ids())
  group by tenant_id, product_id
)
select
  p.tenant_id,
  p.id as product_id,
  p.sku,
  p.name,
  p.min_stock,
  coalesce(s.total_qty, 0) as total_qty,
  (s.product_id is not null and s.total_qty <= 0) as out_of_stock
from public.products p
left join stock_por_producto s on p.id = s.product_id and p.tenant_id = s.tenant_id
where p.tenant_id in (select public.user_tenant_ids())
  and p.active = true
  and (
    (p.min_stock > 0 and coalesce(s.total_qty, 0) <= p.min_stock)
    or (s.product_id is not null and s.total_qty <= 0)
  );

grant select on public.low_stock_alerts to authenticated, service_role;
