-- S4-01: Registrar pagos a proveedores
-- Ver specs/S4-01-pagos-proveedores.md

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  method text not null check (method in ('cash', 'transfer', 'card', 'other')),
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index supplier_payments_tenant_id_idx on public.supplier_payments (tenant_id);
create index supplier_payments_supplier_id_idx on public.supplier_payments (supplier_id);
create index supplier_payments_purchase_id_idx on public.supplier_payments (purchase_id);

alter table public.supplier_payments enable row level security;

-- Política SELECT: miembros del tenant pueden ver.
create policy "supplier_payments_tenant_select" on public.supplier_payments for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Sin política de escritura: INSERT/UPDATE/DELETE denegados implícitamente por defecto
-- ya que RLS está activo y no hay políticas para mutación.
grant select on public.supplier_payments to authenticated, service_role;

-- RPC para registrar el pago
create or replace function public.register_supplier_payment(
  p_supplier_id uuid,
  p_purchase_id uuid,
  p_amount numeric,
  p_method text,
  p_paid_at timestamptz,
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
  v_sup_tenant uuid;
  v_pur_tenant uuid;
  v_pur_supplier uuid;
  v_pur_status text;
  v_pur_total numeric;
  v_paid_so_far numeric;
  v_balance numeric;
  v_payment_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_amount <= 0 then
    raise exception 'payment_amount_invalid' using errcode = 'P0001';
  end if;

  if p_method not in ('cash', 'transfer', 'card', 'other') then
    raise exception 'payment_method_invalid' using errcode = 'P0001';
  end if;

  select tenant_id into v_sup_tenant
  from public.suppliers
  where id = p_supplier_id and active;

  if v_sup_tenant is null then
    raise exception 'supplier_not_found' using errcode = 'P0001';
  end if;

  v_tenant_id := v_sup_tenant;

  -- Ensure the supplier belongs to a tenant the user is in (prevent leaking existence)
  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'supplier_not_found' using errcode = 'P0001';
  end if;

  -- Verify permissions: admin only
  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  -- If tied to a purchase, validate balance
  if p_purchase_id is not null then
    select tenant_id, supplier_id, status, total
      into v_pur_tenant, v_pur_supplier, v_pur_status, v_pur_total
    from public.purchases
    where id = p_purchase_id
    for update;

    if v_pur_tenant is null or v_pur_tenant <> v_tenant_id then
      raise exception 'purchase_not_found' using errcode = 'P0001';
    end if;

    if v_pur_supplier <> p_supplier_id then
      raise exception 'purchase_supplier_mismatch' using errcode = 'P0001';
    end if;

    if v_pur_status not in ('ordered', 'received') then
      raise exception 'purchase_not_payable' using errcode = 'P0001';
    end if;

    select coalesce(sum(amount), 0) into v_paid_so_far
    from public.supplier_payments
    where purchase_id = p_purchase_id;

    v_balance := v_pur_total - v_paid_so_far;

    if p_amount > v_balance then
      raise exception 'payment_exceeds_balance' using errcode = 'P0001';
    end if;
  end if;

  insert into public.supplier_payments (
    tenant_id, supplier_id, purchase_id, amount, paid_at, method, note, created_by
  ) values (
    v_tenant_id, p_supplier_id, p_purchase_id, p_amount, coalesce(p_paid_at, now()), p_method, p_note, v_user_id
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.register_supplier_payment(uuid, uuid, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.register_supplier_payment(uuid, uuid, numeric, text, timestamptz, text) to authenticated;
