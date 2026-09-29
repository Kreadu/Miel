-- S19-26 — Tipos de inventario (productos, materias primas, oficina, mobiliario, vehículos,
-- herramientas, aseo) sobre la misma tabla products: todos heredan stock por bodega o sucursal,
-- movimientos, kardex, stock mínimo, alertas y compras. Datos propios de activos (vehículos,
-- mobiliario, herramientas). Ver specs/done/S19-26-tipos-de-inventario.md. Idempotente.

-- kind 'other' = ítem que no se vende ni se fabrica (oficina, mobiliario, vehículos, etc.).
alter table public.products drop constraint if exists products_kind_check;
alter table public.products
  add constraint products_kind_check check (kind in ('raw', 'finished', 'resale', 'other'));

alter table public.products
  add column if not exists inventory text not null default 'productos',
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists serial_number text,
  add column if not exists purchase_date date,
  add column if not exists plate text,
  add column if not exists vehicle_year integer,
  add column if not exists color text;

alter table public.products drop constraint if exists products_inventory_check;
alter table public.products add constraint products_inventory_check check (inventory in (
  'productos', 'materias_primas', 'articulos_oficina', 'mobiliario', 'vehiculos',
  'herramientas', 'aseo'
));

-- Las materias primas existentes pasan a su propio inventario.
update public.products set inventory = 'materias_primas'
where kind = 'raw' and inventory = 'productos';

create index if not exists products_tenant_inventory_idx on public.products (tenant_id, inventory);

-- Columnas nuevas al final del select (create or replace view no admite insertar en el medio, 42P16).
create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate,
  photo_url, discount_percent, sales_channel, category_id,
  inventory, brand, model, serial_number, purchase_date, plate, vehicle_year, color
from public.products
where tenant_id in (select public.user_tenant_ids());

grant select (inventory, brand, model, serial_number, purchase_date, plate, vehicle_year, color)
  on public.products to authenticated, service_role;
