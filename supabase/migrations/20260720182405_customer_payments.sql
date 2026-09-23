-- S5-04 — Pagos de clientes: tabla customer_payments, RPC register_customer_payment y vista
-- customer_balances. Espejo de S4-01/S4-02 (supplier_payments/supplier_balances), con dos
-- diferencias por la matriz de permisos-roles.md: 1) cualquier miembro (no solo admin) puede
-- registrar un cobro; 2) el saldo consolidado (customer_balances) es visible solo a admin/owner.
-- Ver specs/done/S5-04-pagos-clientes.md.

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  method text not null check (method in ('cash', 'transfer', 'card', 'other')),
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index customer_payments_tenant_id_idx on public.customer_payments (tenant_id);
create index customer_payments_customer_id_idx on public.customer_payments (customer_id);
create index customer_payments_sale_id_idx on public.customer_payments (sale_id);

alter table public.customer_payments enable row level security;

-- Política SELECT: miembros del tenant pueden ver.
create policy "customer_payments_tenant_select" on public.customer_payments for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Sin política de escritura: INSERT/UPDATE/DELETE denegados implícitamente ya que RLS está
-- activo y no hay políticas para mutación. Toda escritura entra por register_customer_payment.
grant select on public.customer_payments to authenticated, service_role;

-- RPC para registrar el cobro. A diferencia de register_supplier_payment (S4-01), NO exige
-- rol admin: cualquier miembro del tenant puede registrar un cobro (permisos-roles.md).
create or replace function public.register_customer_payment(
  p_customer_id uuid,
  p_sale_id uuid,
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
  v_cust_tenant uuid;
  v_sale_tenant uuid;
  v_sale_customer uuid;
  v_sale_status text;
  v_sale_total numeric;
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

  select tenant_id into v_cust_tenant
  from public.customers
  where id = p_customer_id and active;

  if v_cust_tenant is null then
    raise exception 'customer_not_found' using errcode = 'P0001';
  end if;

  v_tenant_id := v_cust_tenant;

  -- Evitar revelar la existencia de un cliente de otro tenant.
  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'customer_not_found' using errcode = 'P0001';
  end if;

  -- Sin chequeo de rol admin: owner/admin/member pueden registrar el cobro.

  if p_sale_id is not null then
    select tenant_id, customer_id, status, total
      into v_sale_tenant, v_sale_customer, v_sale_status, v_sale_total
    from public.sales
    where id = p_sale_id
    for update;

    if v_sale_tenant is null or v_sale_tenant <> v_tenant_id then
      raise exception 'sale_not_found' using errcode = 'P0001';
    end if;

    if v_sale_customer is distinct from p_customer_id then
      raise exception 'sale_customer_mismatch' using errcode = 'P0001';
    end if;

    if v_sale_status not in ('confirmed', 'shipped', 'delivered') then
      raise exception 'sale_not_receivable' using errcode = 'P0001';
    end if;

    select coalesce(sum(amount), 0) into v_paid_so_far
    from public.customer_payments
    where sale_id = p_sale_id;

    v_balance := v_sale_total - v_paid_so_far;

    if p_amount > v_balance then
      raise exception 'payment_exceeds_balance' using errcode = 'P0001';
    end if;
  end if;

  insert into public.customer_payments (
    tenant_id, customer_id, sale_id, amount, paid_at, method, note, created_by
  ) values (
    v_tenant_id, p_customer_id, p_sale_id, p_amount, coalesce(p_paid_at, now()), p_method, p_note, v_user_id
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.register_customer_payment(uuid, uuid, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.register_customer_payment(uuid, uuid, numeric, text, timestamptz, text) to authenticated;

-- Vista de saldos consolidados por cliente. A diferencia de supplier_balances (visible a todo
-- el tenant), aquí se restringe explícitamente a admin/owner en el WHERE (member ✖ saldos
-- globales, permisos-roles.md) — una vista security definer no puede delegar el rol a una
-- política de la tabla, así que se repite el filtro de tenant y de rol aquí mismo.
create or replace view public.customer_balances as
with sale_totals as (
  select customer_id, coalesce(sum(total), 0) as total_sales
  from public.sales
  where status in ('confirmed', 'shipped', 'delivered') and customer_id is not null
  group by customer_id
),
payment_totals as (
  select customer_id, coalesce(sum(amount), 0) as total_paid
  from public.customer_payments
  group by customer_id
)
select
  c.tenant_id,
  c.id as customer_id,
  c.name as customer_name,
  c.doc_number,
  coalesce(st.total_sales, 0) as total_sales,
  coalesce(pt.total_paid, 0) as total_paid,
  (coalesce(st.total_sales, 0) - coalesce(pt.total_paid, 0)) as balance
from public.customers c
left join sale_totals st on c.id = st.customer_id
left join payment_totals pt on c.id = pt.customer_id
where c.tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(c.tenant_id);

grant select on public.customer_balances to authenticated;
