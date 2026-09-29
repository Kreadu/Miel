-- S19-28 — Cada inventario tiene sus propias categorías (no se mezclan).
-- Ver specs/done/S19-28-categorias-por-inventario.md. Idempotente (se puede pegar dos veces).

alter table public.product_categories
  add column if not exists inventory text not null default 'productos';

alter table public.product_categories drop constraint if exists product_categories_inventory_check;
alter table public.product_categories add constraint product_categories_inventory_check check (inventory in (
  'productos', 'materias_primas', 'articulos_oficina', 'mobiliario', 'vehiculos',
  'herramientas', 'aseo'
));

-- El nombre es único dentro de cada inventario (antes: dentro de la empresa).
alter table public.product_categories drop constraint if exists product_categories_tenant_id_name_key;
create unique index if not exists product_categories_tenant_inventory_name_key
  on public.product_categories (tenant_id, inventory, name);

-- Reparto de las categorías existentes: cada una queda en el inventario de los ítems que la
-- usan (productos si la usa algún producto o si no la usa nadie)...
update public.product_categories c
set inventory = coalesce((
  select case when bool_or(p.inventory = 'productos') then 'productos' else min(p.inventory) end
  from public.products p
  where p.category_id = c.id
), 'productos');

-- ...y si la usaban ítems de otros inventarios, se copia allá con el mismo nombre y esos ítems
-- pasan a la copia.
insert into public.product_categories (tenant_id, inventory, name, created_by)
select distinct c.tenant_id, p.inventory, c.name, c.created_by
from public.product_categories c
join public.products p on p.category_id = c.id
where p.inventory <> c.inventory
on conflict (tenant_id, inventory, name) do nothing;

update public.products p
set category_id = n.id
from public.product_categories c, public.product_categories n
where p.category_id = c.id
  and p.inventory <> c.inventory
  and n.tenant_id = c.tenant_id
  and n.inventory = p.inventory
  and n.name = c.name;

-- Invariante: un ítem solo puede tener una categoría de su mismo inventario.
create or replace function public.check_product_category_inventory()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.product_categories
    where id = new.category_id and inventory = new.inventory and tenant_id = new.tenant_id
  ) then
    raise exception 'category_inventory_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_category_inventory on public.products;
create trigger products_category_inventory
  before insert or update of category_id, inventory on public.products
  for each row execute function public.check_product_category_inventory();
