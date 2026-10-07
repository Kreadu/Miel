-- S27-02 — Pedido desde la tienda en línea (ADR-044): el visitante anónimo arma su carrito y
-- place_store_order crea, de forma atómica, el cliente (si es nuevo) y un pedido en borrador
-- (source='store') que la empresa confirma en Vender → Pedidos. Precios siempre de la BD.
-- Ver specs/S27-02-carrito-y-pedido.md.

alter table public.sales
  add column if not exists source text not null default 'internal',
  add column if not exists store_payment text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_source_check') then
    alter table public.sales add constraint sales_source_check check (source in ('internal', 'store'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_store_payment_check') then
    alter table public.sales add constraint sales_store_payment_check
      check (store_payment in ('nequi', 'daviplata', 'transfer', 'cash_on_delivery', 'in_store'));
  end if;
end $$;

-- Lo que llega de la tienda no lo crea un usuario de Miel (F7).
alter table public.sales alter column created_by drop not null;
alter table public.customers alter column created_by drop not null;

create index if not exists sales_store_recent_idx on public.sales (tenant_id, created_at)
  where source = 'store';

-- Celular a solo dígitos; "+57 300…" y "300…" son el mismo número.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when length(d) = 12 and d like '57%' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x
$$;

create or replace function public.place_store_order(
  p_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_delivery text,
  p_payment text,
  p_address text default null,
  p_note text default null
)
returns table (order_code text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_name text := trim(coalesce(p_customer->>'name', ''));
  v_phone text := public.normalize_phone(p_customer->>'phone');
  v_email text := nullif(trim(coalesce(p_customer->>'email', '')), '');
  v_address text := nullif(trim(coalesce(p_address, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_customer_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_product record;
  v_discount numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  select t.id into v_tenant_id
  from public.tenants t
  where p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
    and t.store_slug = p_slug
    and t.store_enabled;
  if v_tenant_id is null then
    raise exception 'store_unavailable' using errcode = 'P0001';
  end if;

  if length(v_name) not between 2 and 80 or length(v_phone) not between 7 and 15
     or length(coalesce(v_email, '')) > 160 then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;
  if length(coalesce(v_address, '')) > 200 or length(coalesce(v_note, '')) > 500 then
    raise exception 'text_too_long' using errcode = 'P0001';
  end if;

  if p_delivery not in ('pickup', 'delivery') then
    raise exception 'delivery_invalid' using errcode = 'P0001';
  end if;
  if p_delivery = 'delivery' and v_address is null then
    raise exception 'address_required' using errcode = 'P0001';
  end if;
  if p_payment is null
     or p_payment not in ('nequi', 'daviplata', 'transfer', 'cash_on_delivery', 'in_store')
     or (p_payment = 'in_store' and p_delivery <> 'pickup') then
    raise exception 'payment_invalid' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30
     or (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x)
        <> jsonb_array_length(p_items) then
    raise exception 'items_invalid' using errcode = 'P0001';
  end if;

  -- Anti-abuso (F5): 3 pedidos por teléfono cada 10 minutos y 100 por tienda por hora.
  if (select count(*) from public.sales s join public.customers c on c.id = s.customer_id
      where s.tenant_id = v_tenant_id and s.source = 'store'
        and s.created_at > now() - interval '10 minutes'
        and public.normalize_phone(c.phone) = v_phone) >= 3
     or (select count(*) from public.sales s
         where s.tenant_id = v_tenant_id and s.source = 'store'
           and s.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too_many_orders' using errcode = 'P0001';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.tenant_id = v_tenant_id and c.active and public.normalize_phone(c.phone) = v_phone
  order by c.created_at
  limit 1;
  if v_customer_id is null then
    insert into public.customers (tenant_id, name, phone, email, address, created_by)
    values (v_tenant_id, v_name, v_phone, v_email, v_address, null)
    returning id into v_customer_id;
  end if;

  insert into public.sales (
    tenant_id, customer_id, status, note, delivery_method, shipping_cost, shipping_address,
    source, store_payment, created_by
  ) values (
    v_tenant_id, v_customer_id, 'draft', v_note,
    case when p_delivery = 'pickup' then 'pickup' else 'agreed' end, 0,
    case when p_delivery = 'delivery' then v_address end,
    'store', p_payment, null
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item->'qty') <> 'number' then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;
    v_qty := (v_item->>'qty')::numeric;
    if v_qty <> trunc(v_qty) or v_qty not between 1 and 99 then
      raise exception 'item_qty_invalid' using errcode = 'P0001';
    end if;

    select p.id, p.name, p.price, p.discount_percent, p.tax_rate, p.active, p.inventory,
           p.sales_channel, p.tenant_id,
           coalesce((select sum(m.qty) from public.stock_movements m
                     where m.product_id = p.id and m.tenant_id = v_tenant_id), 0) as stock
      into v_product
    from public.products p
    where p.id::text = v_item->>'product_id';

    if v_product.id is null or v_product.tenant_id <> v_tenant_id or not v_product.active
       or v_product.inventory <> 'productos' or v_product.sales_channel not in ('online', 'both')
       or v_product.price <= 0 or v_product.stock <= 0 then
      raise exception 'product_unavailable:%', coalesce(v_product.name, '?') using errcode = 'P0001';
    end if;

    v_discount := round(v_qty * v_product.price * v_product.discount_percent / 100, 2);
    insert into public.sale_items (tenant_id, sale_id, product_id, qty, unit_price, discount, tax_rate)
    values (v_tenant_id, v_sale_id, v_product.id, v_qty, v_product.price, v_discount, v_product.tax_rate);

    v_line := round(v_qty * v_product.price - v_discount, 2);
    v_subtotal := v_subtotal + v_line;
    v_tax := v_tax + round(v_line * v_product.tax_rate / 100, 2);
  end loop;

  update public.sales
  set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax
  where id = v_sale_id;

  return query select upper(left(v_sale_id::text, 8)), (v_subtotal + v_tax)::numeric;
end;
$$;

revoke all on function public.place_store_order(text, jsonb, jsonb, text, text, text, text) from public;
grant execute on function public.place_store_order(text, jsonb, jsonb, text, text, text, text) to anon, authenticated;
