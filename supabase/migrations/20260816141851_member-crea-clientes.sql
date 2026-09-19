-- S15-02 — member puede crear clientes desde el punto de venta (ADR-033).
-- Ver specs/S15-02-alta-rapida-cliente-pos.md, docs/arch/permisos-roles.md.
-- No editar 20260720121516_customers.sql (forward-only): esta migración reemplaza la
-- política de insert; select (todo el tenant) y update (admin-only) quedan intactas.

drop policy "customers_admin_write" on public.customers;

create policy "customers_tenant_insert" on public.customers for insert
  with check (tenant_id in (select public.user_tenant_ids()));
