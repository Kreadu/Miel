-- S7-02 — Vistas para finanzas (P&L, flujo de caja y rentabilidad)
-- Ver specs/S7-02-finanzas.md

create view public.monthly_pnl as
with sales_monthly as (
  select
    tenant_id,
    to_char(date_trunc('month', issued_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(coalesce(total_income, 0)) as income,
    sum(coalesce(total_cogs, 0)) as cogs
  from (
    select
      s.tenant_id,
      s.issued_at,
      sum(si.qty * si.unit_price - si.discount) as total_income,
      sum(si.qty * si.unit_cost) as total_cogs
    from public.sales s
    join public.sale_items si on s.id = si.sale_id
    where s.status in ('confirmed', 'shipped', 'delivered')
    group by s.id
  ) sale_totals
  group by tenant_id, to_char(date_trunc('month', issued_at at time zone 'America/Bogota'), 'YYYY-MM')
),
expenses_monthly as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(amount) as expenses
  from public.expenses
  group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM')
)
select
  coalesce(s.tenant_id, e.tenant_id) as tenant_id,
  coalesce(s.month, e.month) as month,
  coalesce(s.income, 0)::numeric(14,2) as income,
  coalesce(s.cogs, 0)::numeric(14,2) as cogs,
  coalesce(e.expenses, 0)::numeric(14,2) as expenses,
  (coalesce(s.income, 0) - coalesce(s.cogs, 0) - coalesce(e.expenses, 0))::numeric(14,2) as utility
from sales_monthly s
full outer join expenses_monthly e on s.tenant_id = e.tenant_id and s.month = e.month
where coalesce(s.tenant_id, e.tenant_id) in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(coalesce(s.tenant_id, e.tenant_id));

create view public.cash_flow as
with cash_in_monthly as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(amount) as cash_in
  from public.customer_payments
  group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM')
),
cash_out_supplier as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(amount) as amount
  from public.supplier_payments
  group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM')
),
cash_out_expense as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(amount) as amount
  from public.expenses
  group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM')
),
cash_out_monthly as (
  select coalesce(s.tenant_id, e.tenant_id) as tenant_id,
         coalesce(s.month, e.month) as month,
         coalesce(s.amount, 0) + coalesce(e.amount, 0) as cash_out
  from cash_out_supplier s
  full outer join cash_out_expense e on s.tenant_id = e.tenant_id and s.month = e.month
)
select
  coalesce(i.tenant_id, o.tenant_id) as tenant_id,
  coalesce(i.month, o.month) as month,
  coalesce(i.cash_in, 0)::numeric(14,2) as cash_in,
  coalesce(o.cash_out, 0)::numeric(14,2) as cash_out,
  (coalesce(i.cash_in, 0) - coalesce(o.cash_out, 0))::numeric(14,2) as net_cash
from cash_in_monthly i
full outer join cash_out_monthly o on i.tenant_id = o.tenant_id and i.month = o.month
where coalesce(i.tenant_id, o.tenant_id) in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(coalesce(i.tenant_id, o.tenant_id));

create view public.product_profitability as
select
  p.tenant_id,
  p.id as product_id,
  p.sku,
  p.name,
  coalesce(sum(si.qty), 0)::numeric(14,3) as sold_qty,
  coalesce(sum(si.qty * si.unit_price - si.discount), 0)::numeric(14,2) as net_income,
  coalesce(sum(si.qty * si.unit_cost), 0)::numeric(14,2) as total_cost,
  coalesce(sum(si.qty * si.unit_price - si.discount) - sum(si.qty * si.unit_cost), 0)::numeric(14,2) as margin_amount,
  case
    when coalesce(sum(si.qty * si.unit_price - si.discount), 0) = 0 then 0::numeric(14,2)
    else ((sum(si.qty * si.unit_price - si.discount) - sum(si.qty * si.unit_cost)) / sum(si.qty * si.unit_price - si.discount) * 100)::numeric(14,2)
  end as margin_percent
from public.products p
join public.sale_items si on p.id = si.product_id
join public.sales s on si.sale_id = s.id
where s.status in ('confirmed', 'shipped', 'delivered')
  and p.tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(p.tenant_id)
group by p.tenant_id, p.id, p.sku, p.name;

create view public.monthly_expenses as
select
  tenant_id,
  to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
  category,
  kind,
  sum(amount)::numeric(14,2) as amount
from public.expenses
where tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(tenant_id)
group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM'), category, kind;

grant select on public.monthly_pnl to authenticated;
grant select on public.cash_flow to authenticated;
grant select on public.product_profitability to authenticated;
grant select on public.monthly_expenses to authenticated;
