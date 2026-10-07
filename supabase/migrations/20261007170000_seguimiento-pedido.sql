-- S27-04 — Seguimiento del pedido de la tienda (ADR-044): el cliente, con la llave secreta de su
-- pedido, ve estado, productos, totales y estado del pago. Nunca datos personales ni ids internos.
-- Requiere la migración de S27-03. Ver specs/S27-04-seguimiento-y-aviso.md.

create or replace function public.store_order_status(p_slug text, p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select s.id, s.tenant_id, s.status, s.created_at, s.subtotal, s.tax, s.shipping_cost, s.total,
           s.delivery_method, s.store_payment, s.payment_proof_at, s.payment_proof_count,
           t.store_nequi, t.store_daviplata, t.store_bank_info, t.store_payment_qr_url,
           t.store_cash_on_delivery, t.store_pay_in_store,
           coalesce((select sum(cp.amount) from public.customer_payments cp where cp.sale_id = s.id), 0) as paid
    from public.sales s
    join public.tenants t on t.id = s.tenant_id
    where p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
      and t.store_slug = p_slug
      and t.store_enabled
      and s.public_token = p_token
      and s.source = 'store'
  )
  select jsonb_build_object(
    'code', upper(left(o.id::text, 8)),
    'created_at', o.created_at,
    'status', o.status,
    'subtotal', o.subtotal,
    'tax', o.tax,
    'shipping_cost', o.shipping_cost,
    'total', o.total,
    'delivery', case when o.delivery_method = 'pickup' then 'pickup' else 'delivery' end,
    'payment', o.store_payment,
    'payment_status', case
      when o.total > 0 and o.paid >= o.total then 'paid'
      when o.payment_proof_at is not null then 'proof_sent'
      else 'pending'
    end,
    'can_upload', o.status <> 'cancelled' and not (o.total > 0 and o.paid >= o.total)
                  and o.payment_proof_count < 5,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', p.name,
               'qty', si.qty,
               'line_total', round(si.qty * si.unit_price - si.discount
                                   + (si.qty * si.unit_price - si.discount) * si.tax_rate / 100, 2)
             ) order by p.name), '[]'::jsonb)
      from public.sale_items si join public.products p on p.id = si.product_id
      where si.sale_id = o.id
    ),
    'payments', jsonb_build_object(
      'nequi', o.store_nequi,
      'daviplata', o.store_daviplata,
      'transfer', o.store_bank_info,
      'qr', o.store_payment_qr_url,
      'cash_on_delivery', o.store_cash_on_delivery,
      'in_store', o.store_pay_in_store
    )
  )
  from o
$$;

revoke all on function public.store_order_status(text, uuid) from public;
grant execute on function public.store_order_status(text, uuid) to anon, authenticated;
