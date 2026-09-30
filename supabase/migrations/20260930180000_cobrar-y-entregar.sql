-- S18-06 — Venta de mostrador en un paso + comprobante boleta/factura.
-- Miel no emite factura electrónica DIAN (ADR-006, S25-01): "factura" deja la venta por emitir
-- hasta que el dueño la marca emitida.

alter table public.sales
  add column if not exists document_type text not null default 'boleta'
    check (document_type in ('boleta', 'factura')),
  add column if not exists invoice_issued_at timestamptz;

-- Crear + confirmar (stock, boleta, caja) + cobrar el total + entregar, en UNA transacción:
-- si cualquier paso falla, no queda nada. Reutiliza las RPC existentes, que ya validan tenant,
-- productos, caja abierta y stock.
create or replace function public.checkout_counter_sale(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer_id uuid,
  p_payment_method text,
  p_warehouse_id uuid,
  p_document_type text default 'boleta',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = 'P0001';
  end if;

  if p_document_type is null or p_document_type not in ('boleta', 'factura') then
    raise exception 'document_type_invalid' using errcode = 'P0001';
  end if;

  -- El cobro exige cliente (register_customer_payment): la acción manda el genérico si no hay.
  if p_customer_id is null then
    raise exception 'customer_invalid' using errcode = 'P0001';
  end if;

  if p_document_type = 'factura' and not exists (
    select 1 from public.customers
    where id = p_customer_id and tenant_id = p_tenant_id
      and not is_generic and coalesce(trim(doc_number), '') <> ''
  ) then
    raise exception 'invoice_customer_required' using errcode = 'P0001';
  end if;

  v_sale_id := public.create_sale(
    p_tenant_id := p_tenant_id,
    p_items := p_items,
    p_customer_id := p_customer_id,
    p_note := p_note,
    p_payment_method := p_payment_method,
    p_delivery_method := 'pickup'
  );

  update public.sales set document_type = p_document_type where id = v_sale_id;

  perform public.confirm_sale(v_sale_id, p_warehouse_id);

  select total into v_total from public.sales where id = v_sale_id;
  if v_total > 0 then
    perform public.register_customer_payment(p_customer_id, v_sale_id, v_total, p_payment_method, now(), null);
  end if;

  perform public.mark_sale_delivered(v_sale_id);

  return v_sale_id;
end;
$$;
revoke all on function public.checkout_counter_sale(uuid, jsonb, uuid, text, uuid, text, text) from public, anon;
grant execute on function public.checkout_counter_sale(uuid, jsonb, uuid, text, uuid, text, text) to authenticated;

-- El dueño emitió la factura en su sistema de facturación: la marca en Miel (owner/admin).
create or replace function public.mark_invoice_issued(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, document_type, status into v_sale
  from public.sales where id = p_sale_id for update;

  if not found or not public.user_is_tenant_admin(v_sale.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_sale.document_type <> 'factura' or v_sale.status = 'cancelled' then
    raise exception 'not_an_invoice' using errcode = 'P0001';
  end if;

  update public.sales set invoice_issued_at = coalesce(invoice_issued_at, now()) where id = p_sale_id;
end;
$$;
revoke all on function public.mark_invoice_issued(uuid) from public, anon;
grant execute on function public.mark_invoice_issued(uuid) to authenticated;

-- Bodega que viene preseleccionada en el carrito: la del trabajador identificado en modo tienda
-- (o la del trabajador ligado a este usuario por correo) si tiene; si no, la principal. Solo
-- devuelve un id de bodega (workers tiene salarios y es solo para admins).
create or replace function public.default_sale_warehouse(p_tenant_id uuid, p_worker_id uuid default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select w.warehouse_id
       from public.workers w
       join public.warehouses wh on wh.id = w.warehouse_id and wh.active
      where w.tenant_id = p_tenant_id and w.active
        and (w.id = p_worker_id or (p_worker_id is null and w.user_id = auth.uid()))
      limit 1),
    (select id from public.warehouses
      where tenant_id = p_tenant_id and active
      order by is_default desc, name
      limit 1)
  )
  where p_tenant_id in (select public.user_tenant_ids());
$$;
revoke all on function public.default_sale_warehouse(uuid, uuid) from public, anon;
grant execute on function public.default_sale_warehouse(uuid, uuid) to authenticated;
