-- S19-08 — sales gana payment_method (descriptivo, no transaccional). create_sale lo acepta.
-- Ver specs/S19-08-desglose-y-forma-de-pago-pedido.md. Idempotente (SQL Editor corre cada
-- sentencia por separado).

alter table public.sales
  add column if not exists payment_method text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_payment_method_check') then
    alter table public.sales
      add constraint sales_payment_method_check
      check (payment_method is null or payment_method in ('cash', 'card', 'transfer', 'other'));
  end if;
end $$;

-- drop first: CREATE OR REPLACE no reemplaza una funcion si cambia su lista de argumentos (crea
-- un overload nuevo y deja el viejo huerfano, sin payment_method) — misma lección de S19-01.
drop function if exists public.create_sale(uuid, jsonb, uuid, text);

create or replace function public.create_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_note text default null,
  p_payment_method text default null
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

  if p_items is null or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;

  insert into public.sales (
    tenant_id, customer_id, status, note, payment_method, created_by
  ) values (
    p_tenant_id, p_customer_id, 'draft', p_note, p_payment_method, v_user_id
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
  end loop;

  update public.sales
  set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax
  where id = v_sale_id;

  return v_sale_id;
end;
$$;
