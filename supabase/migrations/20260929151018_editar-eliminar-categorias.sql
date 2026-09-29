-- S19-21 — Renombrar y eliminar categorías de producto (solo owner/admin).
-- Ver specs/done/S19-21-gestionar-categorias.md. Idempotente (SQL Editor corre cada sentencia aparte).
-- Borrar una categoría no borra productos: products.category_id ya es `on delete set null` (S19-15).

drop policy if exists "product_categories_admin_update" on public.product_categories;
create policy "product_categories_admin_update" on public.product_categories for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

drop policy if exists "product_categories_admin_delete" on public.product_categories;
create policy "product_categories_admin_delete" on public.product_categories for delete
  using (public.user_is_tenant_admin(tenant_id));

grant update (name), delete on public.product_categories to authenticated;
