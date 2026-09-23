-- S13-01 — Un solo camino para dar de alta un producto con su stock inicial.
-- Ver specs/S13-01-alta-producto-con-stock.md, docs/arch/patron-rpc.md, ADR-030.
--
-- `security invoker`: el insert en products queda sujeto a la política existente
-- `products_admin_write` (20260720064734_products.sql) — el control de rol owner/admin no se
-- reimplementa aquí. El movimiento inicial delega en `register_movement`, que ya valida
-- bodega/tenant/signo de cantidad (20260720071129_stock_movements.sql).
--
-- Excepción documentada a la regla 2 de docs/arch/patron-rpc.md ("la función no recibe
-- tenant_id del cliente"): en una creación no hay registro previo del cual derivarlo y un
-- usuario con varias memberships necesita indicar el tenant activo explícito (mismo problema
-- que corrigió S12-04 en open_cash_session). p_tenant_id se resuelve en el servidor vía
-- getActiveTenant(), nunca a ciegas del cliente; RLS de products valida la membership real.
create or replace function public.create_product_with_stock(
  p_tenant_id uuid,
  p_sku text,
  p_name text,
  p_unit text,
  p_kind text,
  p_cost numeric,
  p_price numeric,
  p_tax_rate numeric,
  p_min_stock numeric,
  p_description text default null,
  p_warehouse_id uuid default null,
  p_qty numeric default null
)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_product_id uuid;
begin
  insert into public.products (
    tenant_id, sku, name, description, unit, kind, cost, price, tax_rate, min_stock
  ) values (
    p_tenant_id, p_sku, p_name, p_description, p_unit, p_kind, p_cost, p_price, p_tax_rate, p_min_stock
  ) returning id into v_product_id;

  if p_qty is not null and p_qty > 0 then
    if p_warehouse_id is null then
      raise exception 'warehouse_required' using errcode = 'P0001';
    end if;

    perform public.register_movement(
      v_product_id, p_warehouse_id, 'in', p_qty, p_cost, 'manual', null, 'Stock inicial'
    );
  end if;

  return v_product_id;
end;
$$;

grant execute on function public.create_product_with_stock(
  uuid, text, text, text, text, numeric, numeric, numeric, numeric, text, uuid, numeric
) to authenticated;
