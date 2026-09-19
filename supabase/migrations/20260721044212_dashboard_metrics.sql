-- S8-01 — Vista de métricas para el dashboard gerencial
-- Ver specs/S8-01-dashboard-gerencial.md

create view public.dashboard_metrics as
with inventory as (
  select tenant_id, coalesce(sum(total_value), 0) as inventory_value
  from public.current_stock
  group by tenant_id
),
receivables as (
  select tenant_id, coalesce(sum(balance), 0) as total_receivable
  from public.customer_balances
  group by tenant_id
),
payables as (
  select tenant_id, coalesce(sum(balance), 0) as total_payable
  from public.supplier_balances
  group by tenant_id
),
pnl as (
  select tenant_id,
         coalesce(sum(income), 0) as current_month_sales,
         coalesce(sum(utility), 0) as current_month_utility
  from public.monthly_pnl
  where month = to_char(date_trunc('month', now() at time zone 'America/Bogota'), 'YYYY-MM')
  group by tenant_id
)
select
  t.id as tenant_id,
  coalesce(p.current_month_sales, 0)::numeric(14,2) as current_month_sales,
  coalesce(p.current_month_utility, 0)::numeric(14,2) as current_month_utility,
  coalesce(i.inventory_value, 0)::numeric(14,2) as inventory_value,
  coalesce(r.total_receivable, 0)::numeric(14,2) as total_receivable,
  coalesce(pa.total_payable, 0)::numeric(14,2) as total_payable
from public.tenants t
left join inventory i on i.tenant_id = t.id
left join receivables r on r.tenant_id = t.id
left join payables pa on pa.tenant_id = t.id
left join pnl p on p.tenant_id = t.id
where t.id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(t.id);

grant select on public.dashboard_metrics to authenticated;
