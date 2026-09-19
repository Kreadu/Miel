-- S5-06 — Despacho y entrega de ventas
-- Permite transicionar el estado de las ventas:
-- confirmed -> shipped (con dirección de envío)
-- shipped/confirmed -> delivered (soporta mostrador saltando a entregado)

create or replace function public.mark_sale_shipped(
  p_sale_id uuid,
  p_shipping_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_shipping_address is null or trim(p_shipping_address) = '' then
    raise exception 'shipping_address_required' using errcode = 'P0001';
  end if;

  update public.sales
  set 
    status = 'shipped',
    shipping_address = trim(p_shipping_address),
    shipped_at = now()
  where id = p_sale_id
    and tenant_id in (select public.user_tenant_ids())
    and status = 'confirmed';

  if not found then
    raise exception 'sale_not_confirmed_or_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.mark_sale_delivered(
  p_sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.sales
  set 
    status = 'delivered',
    delivered_at = now()
  where id = p_sale_id
    and tenant_id in (select public.user_tenant_ids())
    and status in ('confirmed', 'shipped');

  if not found then
    raise exception 'sale_not_confirmed_or_shipped' using errcode = 'P0001';
  end if;
end;
$$;
