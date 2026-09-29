-- S19-09 — customers gana is_generic: como maximo un cliente generico por tenant, usado cuando
-- una venta no elige cliente puntual (en vez de customer_id = null). Ver
-- specs/S19-09-cliente-generico.md. Idempotente (SQL Editor corre cada sentencia por separado).

alter table public.customers
  add column if not exists is_generic boolean not null default false;

create unique index if not exists customers_one_generic_per_tenant
  on public.customers (tenant_id) where is_generic;
