-- S21-06 — La nómina entra a Finanzas según la clasificación del trabajador (gasto/costo,
-- fijo/variable). Solo períodos cerrados, en el mes en que termina el período. Costo para la
-- empresa = devengado + aportes del empleador + provisiones. Trabajador sin clasificar = gasto fijo.
-- Ver specs/done/S21-06-nomina-en-finanzas.md. Idempotente.

create or replace view public.monthly_payroll as
select
  p.tenant_id,
  to_char(p.period_end, 'YYYY-MM') as month,
  coalesce(w.cost_classification, 'gasto_fijo') as classification,
  sum(
    s.gross_earnings
    + coalesce((s.result -> 'employerContributions' ->> 'totalContributions')::numeric, 0)
    + coalesce((s.result -> 'provisions' ->> 'totalProvisions')::numeric, 0)
  )::numeric(14,2) as labor_cost,
  -- Lo que sale de caja al pagar: neto a los trabajadores + aportes (las provisiones se pagan después).
  sum(
    s.net_pay
    + s.total_deductions
    + coalesce((s.result -> 'employerContributions' ->> 'totalContributions')::numeric, 0)
  )::numeric(14,2) as cash_out
from public.payroll_settlements s
join public.payroll_periods p on p.id = s.period_id
join public.workers w on w.id = s.worker_id
where p.status = 'closed'
  and p.tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(p.tenant_id)
group by p.tenant_id, to_char(p.period_end, 'YYYY-MM'), coalesce(w.cost_classification, 'gasto_fijo');

grant select on public.monthly_payroll to authenticated;

-- Estado de resultados: columnas nuevas al final (create or replace view no admite insertar en el
-- medio); la utilidad ahora descuenta también la nómina.
create or replace view public.monthly_pnl as
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
),
payroll_monthly as (
  select
    tenant_id,
    month,
    sum(labor_cost) filter (where classification like 'costo_%') as payroll_costs,
    sum(labor_cost) filter (where classification like 'gasto_%') as payroll_expenses
  from public.monthly_payroll
  group by tenant_id, month
),
months as (
  select tenant_id, month from sales_monthly
  union select tenant_id, month from expenses_monthly
  union select tenant_id, month from payroll_monthly
)
select
  m.tenant_id,
  m.month,
  coalesce(s.income, 0)::numeric(14,2) as income,
  coalesce(s.cogs, 0)::numeric(14,2) as cogs,
  coalesce(e.expenses, 0)::numeric(14,2) as expenses,
  (coalesce(s.income, 0) - coalesce(s.cogs, 0) - coalesce(e.expenses, 0)
    - coalesce(p.payroll_costs, 0) - coalesce(p.payroll_expenses, 0))::numeric(14,2) as utility,
  coalesce(p.payroll_costs, 0)::numeric(14,2) as payroll_costs,
  coalesce(p.payroll_expenses, 0)::numeric(14,2) as payroll_expenses
from months m
left join sales_monthly s on s.tenant_id = m.tenant_id and s.month = m.month
left join expenses_monthly e on e.tenant_id = m.tenant_id and e.month = m.month
left join payroll_monthly p on p.tenant_id = m.tenant_id and p.month = m.month
where m.tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(m.tenant_id);

-- Gastos por mes: la nómina clasificada como gasto aparece como categoría "Nómina".
create or replace view public.monthly_expenses as
select
  tenant_id,
  to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
  category,
  kind,
  sum(amount)::numeric(14,2) as amount
from public.expenses
where tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(tenant_id)
group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM'), category, kind
union all
select
  tenant_id,
  month,
  'Nómina' as category,
  case when classification = 'gasto_variable' then 'variable' else 'fixed' end as kind,
  sum(labor_cost)::numeric(14,2) as amount
from public.monthly_payroll
where classification like 'gasto_%'
group by tenant_id, month, case when classification = 'gasto_variable' then 'variable' else 'fixed' end;

-- Flujo de caja: el pago de la nómina es una salida de dinero.
create or replace view public.cash_flow as
with cash_in_monthly as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    sum(amount) as cash_in
  from public.customer_payments
  group by tenant_id, to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM')
),
cash_out_all as (
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    amount
  from public.supplier_payments
  union all
  select
    tenant_id,
    to_char(date_trunc('month', paid_at at time zone 'America/Bogota'), 'YYYY-MM') as month,
    amount
  from public.expenses
  union all
  select tenant_id, month, cash_out as amount from public.monthly_payroll
),
cash_out_monthly as (
  select tenant_id, month, sum(amount) as cash_out from cash_out_all group by tenant_id, month
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
