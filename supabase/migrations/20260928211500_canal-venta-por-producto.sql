-- S19-05 — Canal de venta por producto: solo internet, solo tienda, o ambos.
-- Ver specs/S19-05-canal-de-venta-por-producto.md. Idempotente (mismo criterio que
-- 20260928203117): el SQL Editor de Supabase corre cada sentencia por separado.

alter table public.products
  add column if not exists sales_channel text not null default 'both';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_sales_channel_check') then
    alter table public.products
      add constraint products_sales_channel_check
      check (sales_channel in ('online', 'in_store', 'both'));
  end if;
end $$;

-- sales_channel va AL FINAL del select, mismo motivo que photo_url/discount_percent en
-- 20260928203117: create or replace view no permite insertar columnas en el medio (42P16).
create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate,
  photo_url, discount_percent, sales_channel
from public.products
where tenant_id in (select public.user_tenant_ids());

grant select (
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  photo_url, discount_percent, sales_channel, created_by, created_at, updated_at
) on public.products to authenticated, service_role;
