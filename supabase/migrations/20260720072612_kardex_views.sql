-- Vista de Stock Actual
create or replace view public.current_stock as
select
  product_id,
  warehouse_id,
  tenant_id,
  sum(qty) as total_qty,
  case when public.user_is_tenant_admin(tenant_id) then sum(qty * unit_cost) else null end as total_value
from public.stock_movements
where tenant_id in (select public.user_tenant_ids())
group by product_id, warehouse_id, tenant_id;

-- Vista de Kardex con Window Functions
create or replace view public.kardex as
select
  id as movement_id,
  tenant_id,
  product_id,
  warehouse_id,
  created_at as date,
  ref_type,
  ref_id,
  kind,
  qty,
  case when public.user_is_tenant_admin(tenant_id) then unit_cost else null end as unit_cost,
  sum(qty) over w as accumulated_qty,
  case when public.user_is_tenant_admin(tenant_id) then 
    sum(qty * unit_cost) over w
  else null end as accumulated_value,
  case when public.user_is_tenant_admin(tenant_id) then 
    case when sum(qty) over w > 0 then
      sum(qty * unit_cost) over w / sum(qty) over w
    else 0 end
  else null end as average_cost
from public.stock_movements
where tenant_id in (select public.user_tenant_ids())
window w as (partition by tenant_id, product_id, warehouse_id order by created_at, id);

grant select on public.current_stock to authenticated;
grant select on public.kardex to authenticated;
