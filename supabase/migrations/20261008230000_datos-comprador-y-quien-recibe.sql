-- S27-10 — Pedido de la tienda con documento del comprador, celular con código de país (se guarda
-- tal cual; normalize_phone sigue reconociendo a los clientes colombianos) y datos de quien recibe
-- o recoge si no es el comprador (en el pedido, no en el seguimiento público).
-- Ver specs/S27-10-datos-comprador-y-quien-recibe.md.

alter table public.sales
  add column if not exists receiver_name text,
  add column if not exists receiver_doc text,
  add column if not exists receiver_phone text;

drop function if exists public.place_store_order(text, jsonb, jsonb, text, text, text, text);
create function public.place_store_order(
  p_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_delivery text,
  p_payment text,
  p_address text default null,
  p_note text default null
)
returns table (order_code text, total numeric, token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_name text := trim(coalesce(p_customer->>'name', ''));
  v_phone text := public.normalize_phone(p_customer->>'phone');
  v_email text := nullif(trim(coalesce(p_customer->>'email', '')), '');
  -- S27-10: documento del comprador, celular tal como se escribió (con código de país) y quién
  -- recibe o recoge si no es el comprador.
  v_phone_display text := left(regexp_replace(trim(coalesce(p_customer->>'phone', '')), '\s+', ' ', 'g'), 25);
  v_doc_type text := nullif(trim(coalesce(p_customer->>'doc_type', '')), '');
  v_doc_number text := nullif(trim(coalesce(p_customer->>'doc_number', '')), '');
  v_receiver jsonb := case when jsonb_typeof(p_customer->'receiver') = 'object' then p_customer->'receiver' end;
  v_rcv_name text;
  v_rcv_doc text;
  v_rcv_phone text;
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
  v_store record;
  v_token uuid := gen_random_uuid();
begin
  select t.id, t.store_nequi, t.store_daviplata, t.store_bank_info, t.store_cash_on_delivery,
         t.store_pay_in_store
    into v_store
  from public.tenants t
  where p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
    and t.store_slug = p_slug
    and t.store_enabled;
  v_tenant_id := v_store.id;
  if v_tenant_id is null then
    raise exception 'store_unavailable' using errcode = 'P0001';
  end if;

  if length(v_name) not between 2 and 80 or length(v_phone) not between 7 and 15
     or length(coalesce(v_email, '')) > 160 then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;
  if (v_doc_type is not null and v_doc_type not in ('cc', 'ce', 'nit', 'other'))
     or (v_doc_number is not null and v_doc_number !~ '^[0-9A-Za-z.-]{4,20}$')
     or ((v_doc_type is null) <> (v_doc_number is null)) then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;
  if v_receiver is not null then
    v_rcv_name := trim(coalesce(v_receiver->>'name', ''));
    v_rcv_phone := left(regexp_replace(trim(coalesce(v_receiver->>'phone', '')), '\s+', ' ', 'g'), 25);
    if length(v_rcv_name) not between 2 and 80
       or length(public.normalize_phone(v_rcv_phone)) not between 7 and 15
       or coalesce(v_receiver->>'doc_type', '') not in ('cc', 'ce', 'nit', 'other')
       or coalesce(v_receiver->>'doc_number', '') !~ '^[0-9A-Za-z.-]{4,20}$' then
      raise exception 'receiver_invalid' using errcode = 'P0001';
    end if;
    -- Pasaporte se guarda como 'other' (mismos tipos que la ficha del cliente).
    v_rcv_doc := case v_receiver->>'doc_type' when 'cc' then 'CC' when 'ce' then 'CE' when 'nit' then 'NIT' else 'Pasaporte' end
                 || ' ' || (v_receiver->>'doc_number');
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
     or (p_payment = 'in_store' and (p_delivery <> 'pickup' or not v_store.store_pay_in_store))
     or (p_payment = 'cash_on_delivery' and not v_store.store_cash_on_delivery)
     or (p_payment = 'nequi' and v_store.store_nequi is null)
     or (p_payment = 'daviplata' and v_store.store_daviplata is null)
     or (p_payment = 'transfer' and v_store.store_bank_info is null) then
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
    insert into public.customers (tenant_id, name, phone, email, address, doc_type, doc_number, created_by)
    values (v_tenant_id, v_name, v_phone_display, v_email, v_address, v_doc_type, v_doc_number, null)
    returning id into v_customer_id;
  elsif v_doc_number is not null then
    -- Cliente que ya existía: completa el documento si no lo tenía (no pisa uno ya cargado).
    update public.customers
    set doc_type = coalesce(doc_type, v_doc_type), doc_number = coalesce(doc_number, v_doc_number)
    where id = v_customer_id;
  end if;

  insert into public.sales (
    tenant_id, customer_id, status, note, delivery_method, shipping_cost, shipping_address,
    source, store_payment, public_token, receiver_name, receiver_doc, receiver_phone, created_by
  ) values (
    v_tenant_id, v_customer_id, 'draft', v_note,
    case when p_delivery = 'pickup' then 'pickup' else 'agreed' end, 0,
    case when p_delivery = 'delivery' then v_address end,
    'store', p_payment, v_token, v_rcv_name, v_rcv_doc, v_rcv_phone, null
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

  return query select upper(left(v_sale_id::text, 8)), (v_subtotal + v_tax)::numeric, v_token;
end;
$$;

revoke all on function public.place_store_order(text, jsonb, jsonb, text, text, text, text) from public;
grant execute on function public.place_store_order(text, jsonb, jsonb, text, text, text, text) to anon, authenticated;
