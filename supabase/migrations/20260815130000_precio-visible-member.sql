-- S12-05 — products_catalog dejaba de mostrar `price`/`tax_rate` a member (S2-02),
-- rompiendo el POS con 42501 al leerlos directo de la tabla base (ADR-029): el precio de
-- venta al público no es margen, member sí está autorizado a operar el POS
-- (docs/arch/permisos-roles.md). Solo `cost` sigue oculto. Ver
-- specs/done/S12-05-precio-visible-member.md.

-- El `case ... else null end` original degrada el typmod de price/tax_rate a -1 (numeric sin
-- precisión). Si se exponen pelados aquí, Postgres exige typmod numeric(14,2)/numeric(5,2) y
-- `create or replace view` falla ("cannot change data type of view column"). El cast a
-- `::numeric` mantiene el typmod en -1 para que un futuro `or replace` siga funcionando sin
-- `drop view` — no quitar este cast al tocar la vista de nuevo.
create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate
from public.products
where tenant_id in (select public.user_tenant_ids());
