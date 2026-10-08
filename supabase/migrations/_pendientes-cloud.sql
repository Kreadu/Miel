-- Pegar completo en Supabase → SQL Editor del proyecto (cloud) y ejecutar UNA vez.
-- S26-09 (Crear y enviar / Aprobar y enviar). Borrar este archivo después de aplicarlo.
begin;
-- S26-09 — Orden de compra más rápida: approve_purchase aprueba y envía en un paso (sin el estado
-- intermedio "Aprobada") y un aprobador que edita una orden enviada la deja enviada.
-- Ver specs/S26-09-aprobar-y-enviar.md.

-- 1. "Aprobar y enviar": un borrador (pendiente o ya aprobado por quien lo creó) queda ordenado.
create or replace function public.approve_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_name text;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id
  for update;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if not public.user_can_approve_purchases(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status <> 'draft' then
    raise exception 'purchase_not_pending' using errcode = 'P0001';
  end if;

  v_name := public.my_display_name(v_tenant_id);

  update public.purchases
  set approved_by = coalesce(approved_by, auth.uid()),
      approved_by_name = coalesce(approved_by_name, v_name),
      approved_at = coalesce(approved_at, now()),
      status = 'ordered',
      issued_at = now(),
      ordered_by_name = v_name
  where id = p_purchase_id;
end;
$$;

-- 2. update_purchase: si edita un aprobador, la orden conserva su estado (enviada sigue enviada,
--    con él como aprobador); si edita otro, vuelve a borrador pendiente (A5).
create or replace function public.update_purchase(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_sup_tenant uuid;
  v_can_approve boolean;
  v_name text;
  v_item jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status not in ('draft', 'ordered') then
    raise exception 'purchase_not_updatable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.supplier_payments where purchase_id = p_purchase_id) then
    raise exception 'purchase_has_payments' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  select tenant_id into v_sup_tenant
  from public.suppliers
  where id = p_supplier_id and active;

  if v_sup_tenant is null or v_sup_tenant <> v_tenant_id then
    raise exception 'supplier_invalid' using errcode = 'P0001';
  end if;

  v_can_approve := public.user_can_approve_purchases(v_tenant_id);
  if v_can_approve then
    v_name := public.my_display_name(v_tenant_id);
  end if;

  delete from public.purchase_items
  where purchase_id = p_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_cost < 0 then
      raise exception 'item_unit_cost_invalid' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = v_tenant_id
        and active
    ) then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    insert into public.purchase_items (
      tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate
    ) values (
      v_tenant_id, p_purchase_id, (v_item->>'product_id')::uuid, v_qty, v_unit_cost, v_tax_rate
    );

    v_subtotal := v_subtotal + v_qty * v_unit_cost;
    v_tax := v_tax + v_qty * v_unit_cost * v_tax_rate / 100;
  end loop;

  update public.purchases
  set supplier_id = p_supplier_id,
      note = p_note,
      subtotal = v_subtotal,
      tax = v_tax,
      total = v_subtotal + v_tax,
      status = case when v_can_approve then v_status else 'draft' end,
      issued_at = case when v_can_approve then issued_at end,
      approved_by = case when v_can_approve then auth.uid() end,
      approved_by_name = v_name,
      approved_at = case when v_can_approve then now() end
  where id = p_purchase_id;
end;
$$;
commit;
