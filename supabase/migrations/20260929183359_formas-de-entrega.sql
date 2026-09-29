-- S19-35 — Formas de entrega en el pedido: retiro en tienda, envío gratis en la ciudad, envío
-- acordado (monto a mano) o envío por transporte (tarifas propias: base + por kg + por km).
-- Ver specs/done/S19-35-formas-de-entrega.md. Idempotente.

-- 1. Peso del producto (kg), para cotizar el envío.
alter table public.products
  add column if not exists weight_kg numeric(10,3) not null default 0;
alter table public.products drop constraint if exists products_weight_kg_check;
alter table public.products add constraint products_weight_kg_check check (weight_kg >= 0);

create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate,
  photo_url, discount_percent, sales_channel, category_id,
  inventory, brand, model, serial_number, purchase_date, plate, vehicle_year, color,
  weight_kg
from public.products
where tenant_id in (select public.user_tenant_ids());

grant select (weight_kg) on public.products to authenticated, service_role;

-- 2. Tarifas de transporte de la empresa (Vender → Envíos).
create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  base_price numeric(14,2) not null default 0 check (base_price >= 0),
  price_per_kg numeric(14,2) not null default 0 check (price_per_kg >= 0),
  price_per_km numeric(14,2) not null default 0 check (price_per_km >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists shipping_rates_tenant_id_idx on public.shipping_rates (tenant_id);

drop trigger if exists shipping_rates_set_updated_at on public.shipping_rates;
create trigger shipping_rates_set_updated_at
  before update on public.shipping_rates
  for each row execute function public.set_updated_at();

alter table public.shipping_rates enable row level security;

drop policy if exists "shipping_rates_tenant_select" on public.shipping_rates;
create policy "shipping_rates_tenant_select" on public.shipping_rates for select
  using (tenant_id in (select public.user_tenant_ids()));

drop policy if exists "shipping_rates_admin_insert" on public.shipping_rates;
create policy "shipping_rates_admin_insert" on public.shipping_rates for insert
  with check (public.user_is_tenant_admin(tenant_id));

drop policy if exists "shipping_rates_admin_update" on public.shipping_rates;
create policy "shipping_rates_admin_update" on public.shipping_rates for update
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

drop policy if exists "shipping_rates_admin_delete" on public.shipping_rates;
create policy "shipping_rates_admin_delete" on public.shipping_rates for delete
  using (public.user_is_tenant_admin(tenant_id));

grant select, insert, update, delete on public.shipping_rates to authenticated, service_role;

-- 3. Entrega en la venta.
alter table public.sales
  add column if not exists delivery_method text,
  add column if not exists shipping_rate_id uuid references public.shipping_rates(id) on delete set null,
  add column if not exists shipping_km numeric(10,2),
  add column if not exists shipping_cost numeric(14,2) not null default 0;

alter table public.sales drop constraint if exists sales_delivery_method_check;
alter table public.sales add constraint sales_delivery_method_check check (
  delivery_method is null or delivery_method in ('pickup', 'free_city', 'agreed', 'carrier')
);
alter table public.sales drop constraint if exists sales_shipping_cost_check;
alter table public.sales add constraint sales_shipping_cost_check check (shipping_cost >= 0);

-- 4. create_sale: el envío se calcula acá (no se confía en el valor de la pantalla, salvo el
-- monto "acordado", que es a mano por definición). total = subtotal + iva + envío.
drop function if exists public.create_sale(uuid, jsonb, uuid, text, text);

create or replace function public.create_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_note text default null,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_shipping_rate_id uuid default null,
  p_shipping_km numeric default null,
  p_shipping_cost numeric default null
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
  v_discount numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_weight numeric := 0;
  v_rate record;
  v_shipping numeric := 0;
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

  if p_payment_method is not null and p_payment_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception 'payment_method_invalid' using errcode = 'P0001';
  end if;

  if p_delivery_method is not null
     and p_delivery_method not in ('pickup', 'free_city', 'agreed', 'carrier') then
    raise exception 'delivery_method_invalid' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  insert into public.sales (
    tenant_id, customer_id, status, note, payment_method, delivery_method, created_by
  ) values (
    p_tenant_id, p_customer_id, 'draft', p_note, p_payment_method, p_delivery_method, v_user_id
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);
    v_discount := coalesce((v_item->>'discount')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    if v_unit_price < 0 then
      raise exception 'item_unit_price_invalid' using errcode = 'P0001';
    end if;
    if v_discount < 0 or v_discount > v_qty * v_unit_price then
      raise exception 'item_discount_invalid' using errcode = 'P0001';
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
      tenant_id, sale_id, product_id, qty, unit_price, discount, tax_rate
    ) values (
      p_tenant_id, v_sale_id, (v_item->>'product_id')::uuid, v_qty, v_unit_price, v_discount, v_tax_rate
    );

    v_line := v_qty * v_unit_price - v_discount;
    v_subtotal := v_subtotal + v_line;
    v_tax := v_tax + v_line * v_tax_rate / 100;
    v_weight := v_weight + v_qty * (
      select weight_kg from public.products where id = (v_item->>'product_id')::uuid
    );
  end loop;

  if p_delivery_method = 'agreed' then
    if p_shipping_cost is null or p_shipping_cost < 0 then
      raise exception 'shipping_cost_invalid' using errcode = 'P0001';
    end if;
    v_shipping := p_shipping_cost;
  elsif p_delivery_method = 'carrier' then
    select * into v_rate from public.shipping_rates
    where id = p_shipping_rate_id and tenant_id = p_tenant_id;
    if not found then
      raise exception 'shipping_rate_invalid' using errcode = 'P0001';
    end if;
    if p_shipping_km is null or p_shipping_km < 0 then
      raise exception 'shipping_km_invalid' using errcode = 'P0001';
    end if;
    v_shipping := round(v_rate.base_price + v_rate.price_per_kg * v_weight
                        + v_rate.price_per_km * p_shipping_km, 2);
  end if;

  update public.sales
  set subtotal = v_subtotal,
      tax = v_tax,
      shipping_cost = v_shipping,
      shipping_rate_id = case when p_delivery_method = 'carrier' then p_shipping_rate_id end,
      shipping_km = case when p_delivery_method = 'carrier' then p_shipping_km end,
      total = v_subtotal + v_tax + v_shipping
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

revoke all on function public.create_sale(uuid, jsonb, uuid, text, text, text, uuid, numeric, numeric) from public, anon;
grant execute on function public.create_sale(uuid, jsonb, uuid, text, text, text, uuid, numeric, numeric) to authenticated;
