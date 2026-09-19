-- S5-05 — Ficha CRM e Historial de Cliente: Vista `customer_history`.
-- Muestra el resumen (total compras, monto, promedio, última fecha).
-- Todo rol (owner, admin, member) puede verla según la matriz de permisos.

create or replace view public.customer_history as
with metrics as (
  select
    customer_id,
    count(id) as total_sales_count,
    coalesce(sum(total), 0) as total_sales_amount,
    max(issued_at) as last_sale_at,
    (coalesce(sum(total), 0) / count(id)) as average_ticket
  from public.sales
  where status in ('confirmed', 'shipped', 'delivered')
  group by customer_id
)
select
  c.tenant_id,
  c.id as customer_id,
  c.name as customer_name,
  c.doc_type,
  c.doc_number,
  coalesce(m.total_sales_count, 0)::bigint as total_sales_count,
  coalesce(m.total_sales_amount, 0) as total_sales_amount,
  m.last_sale_at,
  coalesce(m.average_ticket, 0) as average_ticket
from public.customers c
left join metrics m on c.id = m.customer_id
where c.tenant_id in (select public.user_tenant_ids());

grant select on public.customer_history to authenticated;
