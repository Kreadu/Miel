-- S5-02 — Ventas en borrador: sales + sale_items, RLS de solo lectura (la escritura entra
-- únicamente por la RPC) y create_sale (atómica, totales en BD). A diferencia de purchases,
-- cualquier miembro del tenant crea ventas (matriz permisos-roles.md) y el cliente es opcional
-- (venta de mostrador). Tablas nacen con todas las columnas del ciclo de ventas (E5); las
-- columnas de historias futuras (receipt_number, sale_items.unit_cost/discount,
-- cash_session_id, shipping_address/shipped_at/delivered_at) quedan sin lógica hasta
-- S5-03/06/08/09 — ver specs/done/S5-02-ventas-borrador.md.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  issued_at timestamptz,
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  receipt_number integer,
  cash_session_id uuid,
  shipping_address text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax_rate numeric(5,2) not null default 0,
  unit_cost numeric(14,2),
  created_at timestamptz not null default now()
);

create index sales_tenant_id_idx on public.sales (tenant_id);
create index sales_customer_id_idx on public.sales (customer_id);
create index sale_items_tenant_id_idx on public.sale_items (tenant_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Solo lectura por RLS: toda escritura entra por create_sale (security definer), que valida
-- pertenencia al tenant explícitamente dentro de la función — mismo patrón que
-- purchases/create_purchase (S3-02), salvo que aquí no exige rol admin (member sí vende).
create policy "sales_tenant_select" on public.sales for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "sale_items_tenant_select" on public.sale_items for select
  using (tenant_id in (select public.user_tenant_ids()));

grant select on public.sales, public.sale_items to authenticated, service_role;

-- create_sale: crea la cabecera + ítems de forma atómica, calculando subtotal/tax/total en BD
-- (nunca en el cliente). customer_id es opcional (null = venta de mostrador). Cualquier
-- miembro del tenant puede invocarla (matriz permisos-roles.md: crear ventas es ✔ para
-- owner/admin/member, a diferencia de create_purchase que exige admin).
create or replace function public.create_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_unit_price numeric;
  v_tax_rate numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers
    where id = p_customer_id and tenant_id = p_tenant_id and active
  ) then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  -- Cabecera primero (sin totales aún) para poder insertar ítems con su sale_id.
  insert into public.sales (
    tenant_id, customer_id, status, note, created_by
  ) values (
    p_tenant_id, p_customer_id, 'draft', p_note, v_user_id
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_price < 0 then
      raise exception 'item_unit_price_invalid' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.products
      where id = (v_item->>'product_id')::uuid
        and tenant_id = p_tenant_id
        and active
    ) then
      raise exception 'product_invalid' using errcode = 'P0001';
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, qty, unit_price, tax_rate
    ) values (
      p_tenant_id, v_sale_id, (v_item->>'product_id')::uuid, v_qty, v_unit_price, v_tax_rate
    );

    v_subtotal := v_subtotal + v_qty * v_unit_price;
    v_tax := v_tax + v_qty * v_unit_price * v_tax_rate / 100;
  end loop;

  update public.sales
  set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax
  where id = v_sale_id;

  return v_sale_id;
end;
$$;
