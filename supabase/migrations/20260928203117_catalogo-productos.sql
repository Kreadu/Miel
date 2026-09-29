-- S19-02 — Catálogo: products gana photo_url/discount_percent + bucket de Storage para fotos.
-- Ver specs/S19-02-catalogo-productos.md, ADR-035.

-- El SQL Editor de Supabase corre cada sentencia por separado (no como bloque atómico), así
-- que esta migración se escribe idempotente a propósito: es segura de re-ejecutar si un intento
-- anterior quedó a medias por un error de pegado.
alter table public.products
  add column if not exists photo_url text,
  add column if not exists discount_percent numeric(5,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_discount_percent_check'
  ) then
    alter table public.products
      add constraint products_discount_percent_check
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end $$;

-- El cast ::numeric en price/tax_rate viene de 20260815130000 (ADR-029) — no quitarlo, evita
-- que `create or replace view` falle por cambio de typmod. photo_url/discount_percent no son
-- sensibles (a diferencia de cost) asi que van sin enmascarar, igual que sku/name/description.
-- Las columnas nuevas van AL FINAL del select: `create or replace view` no permite reordenar ni
-- insertar columnas en el medio de una vista existente (42P16), solo agregar al final.
create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate,
  photo_url, discount_percent
from public.products
where tenant_id in (select public.user_tenant_ids());

grant select (
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  photo_url, discount_percent, created_by, created_at, updated_at
) on public.products to authenticated, service_role;

-- === Storage: bucket product-photos, publico en lectura, escritura solo admin del tenant ===
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "product_photos_public_read" on storage.objects;
create policy "product_photos_public_read" on storage.objects for select
  using (bucket_id = 'product-photos');

drop policy if exists "product_photos_admin_write" on storage.objects;
create policy "product_photos_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'product-photos'
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "product_photos_admin_delete" on storage.objects;
create policy "product_photos_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'product-photos'
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );
