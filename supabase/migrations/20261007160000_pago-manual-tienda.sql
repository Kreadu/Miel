-- S27-03 — Pago manual de la tienda (ADR-044): la empresa configura sus formas de pago (Nequi,
-- Daviplata, cuenta, QR, contra entrega, pagar al recoger); la tienda ofrece solo esas; cada
-- pedido de la tienda tiene un token secreto con el que el cliente sube su comprobante a un bucket
-- privado. Requiere la migración de S27-02. Ver specs/S27-03-pago-manual.md.

-- 1. Formas de pago de la empresa.
alter table public.tenants
  add column if not exists store_nequi text,
  add column if not exists store_daviplata text,
  add column if not exists store_bank_info text,
  add column if not exists store_payment_qr_url text,
  add column if not exists store_cash_on_delivery boolean not null default true,
  add column if not exists store_pay_in_store boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_store_wallets_check') then
    alter table public.tenants add constraint tenants_store_wallets_check check (
      (store_nequi is null or length(regexp_replace(store_nequi, '\D', '', 'g')) between 7 and 15)
      and (store_daviplata is null or length(regexp_replace(store_daviplata, '\D', '', 'g')) between 7 and 15)
      and (store_bank_info is null or length(store_bank_info) between 1 and 300)
    );
  end if;
end $$;

-- 2. Token secreto y comprobante en el pedido.
alter table public.sales
  add column if not exists public_token uuid,
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_at timestamptz,
  add column if not exists payment_proof_count integer not null default 0;
create unique index if not exists sales_public_token_key on public.sales (public_token)
  where public_token is not null;

-- 3. store_info: lo de antes + formas de pago activas (cambia el tipo de retorno: drop + create).
drop function if exists public.store_info(text);
create function public.store_info(p_slug text)
returns table (
  name text, logo_url text, store_color text, phone text, email text, address text, city text,
  currency text, payments jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, t.logo_url, t.store_color, t.phone, t.email, t.address, t.city, t.currency,
         jsonb_build_object(
           'nequi', t.store_nequi,
           'daviplata', t.store_daviplata,
           'transfer', t.store_bank_info,
           'qr', t.store_payment_qr_url,
           'cash_on_delivery', t.store_cash_on_delivery,
           'in_store', t.store_pay_in_store
         )
  from public.tenants t
  where p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
    and t.store_slug = p_slug
    and t.store_enabled
$$;
revoke all on function public.store_info(text) from public;
grant execute on function public.store_info(text) to anon, authenticated;

-- 4. place_store_order: igual que en S27-02, más métodos activos y el token (cambia el retorno).
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
    insert into public.customers (tenant_id, name, phone, email, address, created_by)
    values (v_tenant_id, v_name, v_phone, v_email, v_address, null)
    returning id into v_customer_id;
  end if;

  insert into public.sales (
    tenant_id, customer_id, status, note, delivery_method, shipping_cost, shipping_address,
    source, store_payment, public_token, created_by
  ) values (
    v_tenant_id, v_customer_id, 'draft', v_note,
    case when p_delivery = 'pickup' then 'pickup' else 'agreed' end, 0,
    case when p_delivery = 'delivery' then v_address end,
    'store', p_payment, v_token, null
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

-- 5. ¿Este token puede subir un comprobante? (lo usa la política de Storage; nunca falla).
create or replace function public.store_order_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from public.sales s
       where s.public_token = p_token::uuid
         and s.source = 'store'
         and s.status <> 'cancelled'
         and s.payment_proof_count < 5
     )
$$;
revoke all on function public.store_order_token_ok(text) from public;
grant execute on function public.store_order_token_ok(text) to anon, authenticated;

-- 6. Registrar el comprobante subido.
create or replace function public.attach_payment_proof(p_token uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path is null or p_path not like p_token::text || '/%' or p_path like '%..%'
     or length(p_path) > 200 or not public.store_order_token_ok(p_token::text) then
    raise exception 'proof_invalid' using errcode = 'P0001';
  end if;

  update public.sales
  set payment_proof_path = p_path,
      payment_proof_at = now(),
      payment_proof_count = payment_proof_count + 1
  where public_token = p_token;
end;
$$;
revoke all on function public.attach_payment_proof(uuid, text) from public;
grant execute on function public.attach_payment_proof(uuid, text) to anon, authenticated;

-- 7. Bucket privado de comprobantes: 5 MB, imágenes y PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sube quien tiene el token (carpeta = token). Solo insert: cada subida es un archivo nuevo.
drop policy if exists "payment_proofs_token_insert" on storage.objects;
create policy "payment_proofs_token_insert" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.store_order_token_ok((storage.foldername(name))[1])
  );

-- Lee la empresa dueña del pedido (para el enlace firmado de "Ver comprobante").
drop policy if exists "payment_proofs_tenant_read" on storage.objects;
create policy "payment_proofs_tenant_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.sales s
      where s.public_token::text = (storage.foldername(name))[1]
        and s.tenant_id in (select public.user_tenant_ids())
    )
  );
