-- Pegar completo en Supabase → SQL Editor del proyecto (cloud) y ejecutar UNA vez.
-- S27-09 (stock visible en la tienda). Borrar este archivo después de aplicarlo.
begin;
-- S27-09 — store_catalog devuelve además el stock total (todas las bodegas, nunca negativo) para
-- mostrar "Quedan N" en la tienda. Ver specs/done/S27-09-stock-en-la-tienda.md.
-- (Antes, S27-08:) Los productos "solo tienda física" también se ven en el catálogo web (publicidad: la
-- gente sabe que existe la tienda). store_catalog devuelve sales_channel para que la web no
-- ofrezca "Agregar" en esos; place_store_order ya los rechaza. Ver specs/S27-08-tienda-fisica-y-pie-kreadu.md.
drop function if exists public.store_catalog(text);
create function public.store_catalog(p_slug text)
returns table (
  product_id uuid, name text, description text, photo_url text, category text,
  price numeric, discount_percent numeric, tax_rate numeric, available boolean, sales_channel text, stock numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with store as (
    select t.id from public.tenants t
    where p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
      and t.store_slug = p_slug
      and t.store_enabled
  ),
  stock as (
    select m.product_id, sum(m.qty) as qty
    from public.stock_movements m
    where m.tenant_id = (select id from store)
    group by m.product_id
  )
  select p.id, p.name, p.description, p.photo_url, c.name,
         p.price::numeric, p.discount_percent::numeric, p.tax_rate::numeric,
         coalesce(s.qty, 0) > 0, p.sales_channel, greatest(coalesce(s.qty, 0), 0)
  from public.products p
  join store on store.id = p.tenant_id
  left join public.product_categories c on c.id = p.category_id
  left join stock s on s.product_id = p.id
  where p.active
    and p.inventory = 'productos'
    and p.price > 0
  order by p.name
$$;
revoke all on function public.store_catalog(text) from public;
grant execute on function public.store_catalog(text) to anon, authenticated;
commit;
