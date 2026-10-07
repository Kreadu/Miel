-- S26-02 — Aprobación de órdenes de compra (ADR-042): aprobadores que marca el dueño, número
-- consecutivo por empresa (OC-0001), firmas "pedida por"/"aprobada por" (nombre de S26-01 guardado
-- en la orden) y ninguna orden pasa a ordered sin aprobación. Sin valores nuevos en status:
-- draft sin approved_at = "Pendiente de aprobación". Ver specs/S26-02-aprobacion-ordenes-de-compra.md.
-- Requiere la migración de S26-01 (memberships.display_name).

-- 1. Aprobadores (el dueño aprueba siempre; los admins si el dueño los marca).
alter table public.memberships
  add column if not exists can_approve_purchases boolean not null default false;

-- La RLS de memberships deja escribir a cualquier admin: la marca solo cambia vía
-- set_purchase_approver (security definer, corre como el dueño de la función).
create or replace function public.guard_can_approve_purchases()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and new.can_approve_purchases
     is distinct from (case when tg_op = 'UPDATE' then old.can_approve_purchases else false end) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_guard_can_approve on public.memberships;
create trigger memberships_guard_can_approve
  before insert or update on public.memberships
  for each row execute function public.guard_can_approve_purchases();

create or replace function public.user_can_approve_purchases(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and (role = 'owner' or (role = 'admin' and can_approve_purchases))
  )
$$;
revoke all on function public.user_can_approve_purchases(uuid) from public, anon;
grant execute on function public.user_can_approve_purchases(uuid) to authenticated;

create or replace function public.set_purchase_approver(p_membership_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_role text;
begin
  select tenant_id, role into v_tenant_id, v_role
  from public.memberships where id = p_membership_id;

  if v_tenant_id is null or not exists (
    select 1 from public.memberships
    where tenant_id = v_tenant_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_role <> 'admin' then
    raise exception 'approver_invalid' using errcode = 'P0001';
  end if;

  update public.memberships set can_approve_purchases = coalesce(p_value, false)
  where id = p_membership_id;
end;
$$;
revoke all on function public.set_purchase_approver(uuid, boolean) from public, anon;
grant execute on function public.set_purchase_approver(uuid, boolean) to authenticated;

-- 2. Número y firmas en la orden.
alter table public.purchases
  add column if not exists number integer,
  add column if not exists requested_by_name text,
  add column if not exists requested_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_by_name text,
  add column if not exists approved_at timestamptz;

-- 3. Contador por empresa (patrón sale_counters: solo lectura, escritura por trigger/RPC).
create table if not exists public.purchase_counters (
  tenant_id uuid primary key references public.tenants(id) on delete restrict,
  last_no integer not null default 0
);

alter table public.purchase_counters enable row level security;

drop policy if exists "purchase_counters_tenant_select" on public.purchase_counters;
create policy "purchase_counters_tenant_select" on public.purchase_counters for select
  using (tenant_id in (select public.user_tenant_ids()));

grant select on public.purchase_counters to authenticated, service_role;

-- 4. Órdenes existentes: numeradas por fecha de creación (A3).
with numbered as (
  select id, row_number() over (partition by tenant_id order by created_at, id) as n
  from public.purchases
  where number is null
)
update public.purchases p set number = numbered.n
from numbered where numbered.id = p.id;

insert into public.purchase_counters (tenant_id, last_no)
select tenant_id, max(number) from public.purchases group by tenant_id
on conflict (tenant_id) do update set last_no = greatest(public.purchase_counters.last_no, excluded.last_no);

-- 5. Toda orden nueva toma el siguiente número (RPC o inserción directa). El upsert serializa
-- por empresa: dos órdenes a la vez no repiten número; el índice único es la red de seguridad.
create or replace function public.assign_purchase_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.number is null then
    insert into public.purchase_counters as c (tenant_id, last_no)
    values (new.tenant_id, 1)
    on conflict (tenant_id) do update set last_no = c.last_no + 1
    returning c.last_no into new.number;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_assign_number on public.purchases;
create trigger purchases_assign_number
  before insert on public.purchases
  for each row execute function public.assign_purchase_number();

alter table public.purchases alter column number set not null;
create unique index if not exists purchases_tenant_number_key on public.purchases (tenant_id, number);

-- 6. Nombre de quien firma (S26-01). Sin nombre no se pide ni se aprueba.
create or replace function public.my_display_name(p_tenant_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select nullif(trim(display_name), '') into v_name
  from public.memberships
  where tenant_id = p_tenant_id and user_id = auth.uid();
  if v_name is null then
    raise exception 'display_name_required' using errcode = 'P0001';
  end if;
  return v_name;
end;
$$;
revoke all on function public.my_display_name(uuid) from public, anon, authenticated;

-- 7. create_purchase: firma "pedida por"; si quien pide aprueba, nace aprobada (A2).
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
  v_name text;
  v_can_approve boolean;
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

  v_can_approve := public.user_can_approve_purchases(v_tenant_id);
  if p_status = 'ordered' and not v_can_approve then
    raise exception 'approval_required' using errcode = 'P0001';
  end if;

  v_name := public.my_display_name(v_tenant_id);

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  insert into public.purchases (
    tenant_id, supplier_id, status, issued_at, note, created_by,
    requested_by_name, requested_at, approved_by, approved_by_name, approved_at
  ) values (
    v_tenant_id, p_supplier_id, p_status,
    case when p_status = 'ordered' then now() else null end,
    p_note, v_user_id,
    v_name, now(),
    case when v_can_approve then v_user_id end,
    case when v_can_approve then v_name end,
    case when v_can_approve then now() end
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

-- 8. approve_purchase: un aprobador firma una orden pendiente.
create or replace function public.approve_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_approved_at timestamptz;
  v_name text;
begin
  select tenant_id, status, approved_at into v_tenant_id, v_status, v_approved_at
  from public.purchases
  where id = p_purchase_id;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if not public.user_can_approve_purchases(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status <> 'draft' or v_approved_at is not null then
    raise exception 'purchase_not_pending' using errcode = 'P0001';
  end if;

  v_name := public.my_display_name(v_tenant_id);

  update public.purchases
  set approved_by = auth.uid(), approved_by_name = v_name, approved_at = now()
  where id = p_purchase_id;
end;
$$;
revoke all on function public.approve_purchase(uuid) from public, anon;
grant execute on function public.approve_purchase(uuid) to authenticated;

-- 9. mark_purchase_ordered: además de draft, exige aprobación.
create or replace function public.mark_purchase_ordered(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
  v_approved_at timestamptz;
begin
  select tenant_id, status, approved_at into v_tenant_id, v_status, v_approved_at
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

  if v_approved_at is null then
    raise exception 'approval_required' using errcode = 'P0001';
  end if;

  update public.purchases
  set status = 'ordered', issued_at = now()
  where id = p_purchase_id;
end;
$$;

-- 10. update_purchase: editar quita la aprobación y vuelve a borrador; si edita un aprobador,
-- queda aprobada de nuevo con su nombre (A5). Con pagos ligados no se edita.
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

  -- Volver a borrador la sacaría de las cuentas por pagar con un pago ya ligado.
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
      status = 'draft',
      issued_at = null,
      approved_by = case when v_can_approve then auth.uid() end,
      approved_by_name = v_name,
      approved_at = case when v_can_approve then now() end
  where id = p_purchase_id;
end;
$$;
