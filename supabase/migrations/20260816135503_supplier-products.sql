-- S15-01 — Catálogo de productos por proveedor: tabla supplier_products (relación
-- proveedor↔producto), RLS (lectura todo el tenant, escritura solo owner/admin — gestionar
-- catálogos, permisos-roles.md). Sin soft-delete: relación sin historial, DELETE físico.
-- Ver specs/S15-01-catalogo-por-proveedor.md, docs/arch/multitenancy-rls.md.

-- FKs compuestas (blindaje extra de aislamiento cruzado, además de la política RLS) requieren
-- unique (id, tenant_id) en las tablas referenciadas. Aditivo: no toca las migraciones que
-- crearon suppliers/products.
alter table public.suppliers add constraint suppliers_id_tenant_key unique (id, tenant_id);
alter table public.products add constraint products_id_tenant_key unique (id, tenant_id);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supplier_id uuid not null,
  product_id uuid not null,
  -- null = asociado a mano, aún sin recepción; receive_purchase lo actualiza al recibir.
  last_purchased_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (supplier_id, product_id),
  foreign key (supplier_id, tenant_id) references public.suppliers (id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id) references public.products (id, tenant_id) on delete cascade
);

create index supplier_products_tenant_id_idx on public.supplier_products (tenant_id);
create index supplier_products_product_id_idx on public.supplier_products (product_id);

alter table public.supplier_products enable row level security;

-- Ver sugerencias: todo el equipo del tenant (member arma órdenes y necesita ver lo sugerido).
create policy "supplier_products_tenant_select" on public.supplier_products for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Gestionar la relación a mano: solo owner/admin (permisos-roles.md). La asociación automática
-- al recibir una compra no pasa por esta política: receive_purchase es security definer y
-- bypasa RLS, igual que ya hace con stock_movements/purchase_items — así un member que recibe
-- la compra sí alimenta el catálogo aunque no pueda escribir esta tabla directo por PostgREST.
create policy "supplier_products_admin_insert" on public.supplier_products for insert
  with check (public.user_is_tenant_admin(tenant_id));

create policy "supplier_products_admin_delete" on public.supplier_products for delete
  using (public.user_is_tenant_admin(tenant_id));

-- Sin política ni grant de update: el único UPDATE (last_purchased_at) lo hace receive_purchase.
grant select, insert, delete on public.supplier_products to authenticated, service_role;
