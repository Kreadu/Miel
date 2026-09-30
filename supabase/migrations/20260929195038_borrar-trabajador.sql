-- S21-02b — Borrar trabajador (además de retirarlo): solo owner/admin. Idempotente.
-- Ver specs/done/S21-02-trabajadores-y-categorias.md (ajuste 2026-09-29).
drop policy if exists "workers_admin_delete" on public.workers;
create policy "workers_admin_delete" on public.workers for delete
  using (public.user_is_tenant_admin(tenant_id));

grant delete on public.workers to authenticated;
