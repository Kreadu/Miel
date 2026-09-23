-- S3-02 — Órdenes de compra: purchases + purchase_items, RLS de solo lectura (la escritura
-- entra únicamente por las RPCs), create_purchase (atómica, totales en BD) y
-- mark_purchase_ordered. Ver specs/done/S3-02-ordenes-compra.md, docs/arch/patron-rpc.md.

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'received', 'cancelled')),
  issued_at timestamptz,
  received_at timestamptz,
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  tax_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create index purchases_tenant_id_idx on public.purchases (tenant_id);
create index purchases_supplier_id_idx on public.purchases (supplier_id);
create index purchase_items_tenant_id_idx on public.purchase_items (tenant_id);
create index purchase_items_purchase_id_idx on public.purchase_items (purchase_id);
create index purchase_items_product_id_idx on public.purchase_items (product_id);

create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

-- Solo lectura por RLS: toda escritura entra por create_purchase/mark_purchase_ordered
-- (security definer), que valida el rol admin explícitamente dentro de la función — mismo
-- patrón que stock_movements/register_movement (S2-03): un security definer bypassa RLS, así
-- que la autorización de rol no puede delegarse a una política de la tabla.
create policy "purchases_tenant_select" on public.purchases for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "purchase_items_tenant_select" on public.purchase_items for select
  using (tenant_id in (select public.user_tenant_ids()));

grant select on public.purchases, public.purchase_items to authenticated, service_role;

-- create_purchase: crea la cabecera + ítems de forma atómica, calculando subtotal/tax/total
-- en BD (nunca en el cliente). p_status ('draft'|'ordered') fija si issued_at se marca ya.
create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_status text,
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_purchase_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id into v_tenant_id
  from public.suppliers
  where id = p_supplier_id and active;
  if v_tenant_id is null then
    raise exception 'supplier_invalid' using errcode = 'P0001';
  end if;

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_status not in ('draft', 'ordered') then
    raise exception 'status_invalid' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  -- Cabecera primero (sin totales aún) para poder insertar ítems con su purchase_id.
  insert into public.purchases (
    tenant_id, supplier_id, status, issued_at, note, created_by
  ) values (
    v_tenant_id, p_supplier_id, p_status,
    case when p_status = 'ordered' then now() else null end,
    p_note, v_user_id
  ) returning id into v_purchase_id;

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
      v_tenant_id, v_purchase_id, (v_item->>'product_id')::uuid, v_qty, v_unit_cost, v_tax_rate
    );

    v_subtotal := v_subtotal + v_qty * v_unit_cost;
    v_tax := v_tax + v_qty * v_unit_cost * v_tax_rate / 100;
  end loop;

  update public.purchases
  set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax
  where id = v_purchase_id;

  return v_purchase_id;
end;
$$;

-- mark_purchase_ordered: transiciona una orden draft existente a ordered, fijando issued_at.
create or replace function public.mark_purchase_ordered(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
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

  if v_status <> 'draft' then
    raise exception 'purchase_not_draft' using errcode = 'P0001';
  end if;

  update public.purchases
  set status = 'ordered', issued_at = now()
  where id = p_purchase_id;
end;
$$;
