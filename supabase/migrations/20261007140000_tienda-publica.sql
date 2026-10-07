-- S27-01 — Tienda pública de cada empresa (ADR-044): ajustes en tenants (solo admin vía la RLS
-- que ya existe; las reglas viven aquí como CHECK) y las dos únicas puertas para el público
-- (anon): store_info y store_catalog, security definer con columnas enumeradas.
-- Ver specs/S27-01-tienda-publica-catalogo.md.

alter table public.tenants
  add column if not exists store_enabled boolean not null default false,
  add column if not exists store_slug text,
  add column if not exists store_color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_store_slug_format') then
    -- 3 a 40 caracteres: minúsculas, números y guiones; sin guion al inicio ni al final.
    alter table public.tenants add constraint tenants_store_slug_format
      check (store_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_store_slug_reserved') then
    -- Futuros subdominios de la plataforma (S27-07).
    alter table public.tenants add constraint tenants_store_slug_reserved
      check (store_slug not in (
        'www', 'app', 'api', 'admin', 'miel', 'tienda', 'tiendas', 'login', 'signup', 'auth',
        'mail', 'email', 'soporte', 'support', 'ayuda', 'help', 'blog', 'docs', 'status', 'cdn',
        'static', 'assets', 'img', 'media', 'files', 'dev', 'staging', 'test', 'demo'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_store_color_format') then
    alter table public.tenants add constraint tenants_store_color_format
      check (store_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_store_enabled_needs_slug') then
    alter table public.tenants add constraint tenants_store_enabled_needs_slug
      check (not store_enabled or store_slug is not null);
  end if;
end $$;

create unique index if not exists tenants_store_slug_key on public.tenants (store_slug)
  where store_slug is not null;

-- Datos públicos de la tienda: solo si está activa. Nunca NIT ni nada interno.
create or replace function public.store_info(p_slug text)
returns table (
  name text, logo_url text, store_color text, phone text, email text, address text, city text,
  currency text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, t.logo_url, t.store_color, t.phone, t.email, t.address, t.city, t.currency
  from public.tenants t
  where p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
    and t.store_slug = p_slug
    and t.store_enabled
$$;

-- Catálogo público: productos vendibles por internet. Disponible = suma de todas las bodegas > 0;
-- nunca devuelve costo, SKU ni cantidades.
create or replace function public.store_catalog(p_slug text)
returns table (
  product_id uuid, name text, description text, photo_url text, category text,
  price numeric, discount_percent numeric, tax_rate numeric, available boolean
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
         coalesce(s.qty, 0) > 0
  from public.products p
  join store on store.id = p.tenant_id
  left join public.product_categories c on c.id = p.category_id
  left join stock s on s.product_id = p.id
  where p.active
    and p.inventory = 'productos'
    and p.price > 0
    and p.sales_channel in ('online', 'both')
  order by p.name
$$;

revoke all on function public.store_info(text) from public;
revoke all on function public.store_catalog(text) from public;
grant execute on function public.store_info(text) to anon, authenticated;
grant execute on function public.store_catalog(text) to anon, authenticated;
