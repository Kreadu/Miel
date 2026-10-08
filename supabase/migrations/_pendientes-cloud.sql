-- Pegar completo en Supabase → SQL Editor del proyecto (cloud) y ejecutar UNA vez.
-- S28-01 + S28-02 + S28-03 (recepción con factura, precio al recibir, corregir/anular factura). Borrar este archivo después de aplicarlo.
begin;
-- S28-01 — Recepción de compras con la factura del proveedor, línea por línea y parcial.
-- Cada línea guardada entra al kardex a su costo real sin IVA (ADR-038, promedio ponderado); lo
-- que no llega queda pendiente o la orden se cierra con faltantes; la deuda con el proveedor es el
-- total de sus facturas. Ver specs/S28-01-recepcion-con-factura.md.

-- 1. Estados y columnas nuevas.
alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check
  check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled'));
alter table public.purchases
  add column if not exists closed_short boolean not null default false,
  add column if not exists shortage_note text,
  add column if not exists invoiced_total numeric(14,2);

alter table public.purchase_items
  add column if not exists received_qty numeric(14,3) not null default 0;
-- Órdenes recibidas antes de esta historia: todo recibido.
update public.purchase_items pi set received_qty = pi.qty
from public.purchases p
where p.id = pi.purchase_id and p.status = 'received' and pi.received_qty = 0;
alter table public.purchase_items drop constraint if exists purchase_items_received_qty_check;
alter table public.purchase_items add constraint purchase_items_received_qty_check
  check (received_qty >= 0 and received_qty <= qty);

-- 2. Facturas del proveedor (una orden puede tener varias: entregas parciales).
create table public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  number text not null check (length(btrim(number)) between 1 and 60),
  issued_on date not null,
  due_on date,
  cufe text check (length(cufe) <= 200),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  tax numeric(14,2) not null check (tax >= 0),
  total numeric(14,2) not null check (total = subtotal + tax),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  file_path text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index purchase_invoices_number_uidx
  on public.purchase_invoices (tenant_id, supplier_id, lower(btrim(number)));
create index purchase_invoices_tenant_id_idx on public.purchase_invoices (tenant_id);
create index purchase_invoices_purchase_id_idx on public.purchase_invoices (purchase_id);
create index purchase_invoices_supplier_id_idx on public.purchase_invoices (supplier_id);
create index purchase_invoices_warehouse_id_idx on public.purchase_invoices (warehouse_id);

-- 3. Cada línea guardada (cantidad y costo reales de esa factura).
create table public.purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  invoice_id uuid not null references public.purchase_invoices(id) on delete restrict,
  -- cascade: update_purchase reemplaza los ítems; solo puede hacerlo sin nada recibido (líneas anuladas).
  purchase_item_id uuid not null references public.purchase_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  tax_rate numeric(5,2) not null check (tax_rate between 0 and 100),
  movement_id uuid not null references public.stock_movements(id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index purchase_receipt_lines_tenant_id_idx on public.purchase_receipt_lines (tenant_id);
create index purchase_receipt_lines_invoice_id_idx on public.purchase_receipt_lines (invoice_id);
create index purchase_receipt_lines_purchase_item_id_idx on public.purchase_receipt_lines (purchase_item_id);
create index purchase_receipt_lines_product_id_idx on public.purchase_receipt_lines (product_id);
create index purchase_receipt_lines_movement_id_idx on public.purchase_receipt_lines (movement_id);

-- Solo lectura y solo dueño/admin (tienen costos, ADR-029). La escritura va por las RPC.
alter table public.purchase_invoices enable row level security;
alter table public.purchase_receipt_lines enable row level security;
create policy "purchase_invoices_admin_select" on public.purchase_invoices for select
  using (tenant_id in (select public.user_tenant_ids()) and public.user_is_tenant_admin(tenant_id));
create policy "purchase_receipt_lines_admin_select" on public.purchase_receipt_lines for select
  using (tenant_id in (select public.user_tenant_ids()) and public.user_is_tenant_admin(tenant_id));
revoke all on public.purchase_invoices, public.purchase_receipt_lines from anon, authenticated;
grant select on public.purchase_invoices, public.purchase_receipt_lines to authenticated, service_role;

-- 4. Estado de la orden según lo recibido (sin faltantes cerrados).
create or replace function public.refresh_purchase_reception(p_purchase_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.purchases p
  set status = case
        when not exists (select 1 from public.purchase_items where purchase_id = p.id and received_qty < qty) then 'received'
        when exists (select 1 from public.purchase_items where purchase_id = p.id and received_qty > 0) then 'partially_received'
        else 'ordered'
      end,
      received_at = case
        when not exists (select 1 from public.purchase_items where purchase_id = p.id and received_qty < qty) then now()
      end,
      closed_short = false,
      shortage_note = null
  where p.id = p_purchase_id;
$$;
revoke all on function public.refresh_purchase_reception(uuid) from public, anon, authenticated;

-- 5. Factura: cualquier persona de la empresa la ingresa (la tiene en la mano).
create or replace function public.create_purchase_invoice(
  p_purchase_id uuid,
  p_number text,
  p_issued_on date,
  p_due_on date,
  p_cufe text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_warehouse_id uuid,
  p_file_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_supplier_id uuid;
  v_status text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, supplier_id, status into v_tenant_id, v_supplier_id, v_status
  from public.purchases where id = p_purchase_id for update;
  if v_tenant_id is null or v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_number), '') = '' or p_issued_on is null then
    raise exception 'invoice_invalid' using errcode = 'P0001';
  end if;
  if p_subtotal is null or p_tax is null or p_total is null
     or p_subtotal < 0 or p_tax < 0 or p_total <> p_subtotal + p_tax then
    raise exception 'invoice_totals_invalid' using errcode = 'P0001';
  end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> v_tenant_id::text then
    raise exception 'invoice_file_invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.purchase_invoices
    where tenant_id = v_tenant_id and supplier_id = v_supplier_id and lower(btrim(number)) = lower(btrim(p_number))
  ) then
    raise exception 'invoice_number_taken' using errcode = 'P0001';
  end if;

  insert into public.purchase_invoices (
    tenant_id, purchase_id, supplier_id, number, issued_on, due_on, cufe, subtotal, tax, total, warehouse_id, file_path
  ) values (
    v_tenant_id, p_purchase_id, v_supplier_id, btrim(p_number), p_issued_on, p_due_on, nullif(btrim(p_cufe), ''),
    p_subtotal, p_tax, p_total, p_warehouse_id, p_file_path
  ) returning id into v_id;

  update public.purchases
  set invoiced_total = (select sum(total) from public.purchase_invoices where purchase_id = p_purchase_id)
  where id = p_purchase_id;

  return v_id;
end;
$$;
revoke all on function public.create_purchase_invoice(uuid, text, date, date, text, numeric, numeric, numeric, uuid, text) from public, anon;
grant execute on function public.create_purchase_invoice(uuid, text, date, date, text, numeric, numeric, numeric, uuid, text) to authenticated;

-- 6. Guardar una línea: entra al kardex de una vez. Un miembro no pone costos (R2).
create or replace function public.receive_purchase_line(
  p_invoice_id uuid,
  p_purchase_item_id uuid,
  p_qty numeric,
  p_unit_cost numeric,
  p_tax_rate numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_item record;
  v_status text;
  v_cost numeric;
  v_tax numeric;
  v_movement_id uuid;
  v_line_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  select * into v_item from public.purchase_items
  where id = p_purchase_item_id and purchase_id = v_inv.purchase_id;
  if v_item.id is null then
    raise exception 'item_invalid' using errcode = 'P0001';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty_invalid' using errcode = 'P0001';
  end if;
  if v_item.received_qty + p_qty > v_item.qty then
    raise exception 'qty_exceeds_pending' using errcode = 'P0001';
  end if;

  if public.user_is_tenant_admin(v_inv.tenant_id) then
    if p_unit_cost is null or p_unit_cost < 0 or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
      raise exception 'cost_invalid' using errcode = 'P0001';
    end if;
    v_cost := round(p_unit_cost, 2);
    v_tax := p_tax_rate;
  else
    v_cost := v_item.unit_cost;
    v_tax := v_item.tax_rate;
  end if;

  v_movement_id := public.register_movement(
    v_item.product_id, v_inv.warehouse_id, 'in', p_qty, v_cost,
    'purchase', v_inv.purchase_id::text, 'Factura ' || v_inv.number
  );

  insert into public.purchase_receipt_lines (
    tenant_id, invoice_id, purchase_item_id, product_id, qty, unit_cost, tax_rate, movement_id
  ) values (
    v_inv.tenant_id, p_invoice_id, p_purchase_item_id, v_item.product_id, p_qty, v_cost, v_tax, v_movement_id
  ) returning id into v_line_id;

  update public.purchase_items set received_qty = received_qty + p_qty where id = p_purchase_item_id;

  insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
  values (v_inv.tenant_id, v_inv.supplier_id, v_item.product_id, now())
  on conflict (supplier_id, product_id) do update set last_purchased_at = excluded.last_purchased_at;

  perform public.refresh_purchase_reception(v_inv.purchase_id);
  return v_line_id;
end;
$$;
revoke all on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric) from public, anon;
grant execute on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric) to authenticated;

-- 7. Anular una línea guardada por error (R6): sale al mismo costo con el que entró.
create or replace function public.void_purchase_receipt_line(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_inv record;
  v_status text;
  v_wh_stock numeric;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_line from public.purchase_receipt_lines where id = p_line_id for update;
  if v_line.id is null or v_line.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'line_not_found' using errcode = 'P0001';
  end if;
  if not public.user_is_tenant_admin(v_line.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_line.voided_at is not null then
    raise exception 'line_already_voided' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = v_line.invoice_id;
  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status = 'cancelled' then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  select coalesce(sum(qty), 0) into v_wh_stock from public.stock_movements
  where product_id = v_line.product_id and warehouse_id = v_inv.warehouse_id;
  if v_wh_stock < v_line.qty then
    raise exception 'stock_insufficient' using errcode = 'P0001';
  end if;

  insert into public.stock_movements (
    tenant_id, product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, created_by
  ) values (
    v_line.tenant_id, v_line.product_id, v_inv.warehouse_id, 'out', -v_line.qty, v_line.unit_cost,
    'purchase', v_inv.purchase_id::text, 'Anulación factura ' || v_inv.number, auth.uid()
  );

  -- Costo promedio sin esa entrada (mismo cálculo que register_movement).
  update public.products p
  set cost = round(k.value / k.qty, 2)
  from (
    select sum(qty) as qty, sum(qty * unit_cost) as value
    from public.stock_movements where product_id = v_line.product_id
  ) k
  where p.id = v_line.product_id and k.qty > 0;

  update public.purchase_receipt_lines set voided_at = now(), voided_by = auth.uid() where id = p_line_id;
  update public.purchase_items set received_qty = received_qty - v_line.qty where id = v_line.purchase_item_id;
  perform public.refresh_purchase_reception(v_inv.purchase_id);
end;
$$;
revoke all on function public.void_purchase_receipt_line(uuid) from public, anon;
grant execute on function public.void_purchase_receipt_line(uuid) to authenticated;

-- 8. Cerrar con faltantes: el proveedor no mandará el resto (R4).
create or replace function public.close_purchase_short(p_purchase_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases where id = p_purchase_id for update;
  if v_tenant_id is null or v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;
  if v_status <> 'partially_received' then
    raise exception 'purchase_not_partial' using errcode = 'P0001';
  end if;

  update public.purchases
  set status = 'received', received_at = now(), closed_short = true,
      shortage_note = nullif(left(btrim(p_note), 500), '')
  where id = p_purchase_id;
end;
$$;
revoke all on function public.close_purchase_short(uuid, text) from public, anon;
grant execute on function public.close_purchase_short(uuid, text) to authenticated;

-- 9. Recibir todo (S3-03) también deja lo recibido completo.
create or replace function public.receive_purchase(
  p_purchase_id uuid,
  p_warehouse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_status      text;
  v_supplier_id uuid;
  v_wh_tenant   uuid;
  v_item        record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, status, supplier_id into v_tenant_id, v_status, v_supplier_id
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  select tenant_id into v_wh_tenant from public.warehouses where id = p_warehouse_id;
  if v_wh_tenant is null or v_wh_tenant <> v_tenant_id then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;

  if v_status <> 'ordered' then
    raise exception 'purchase_not_ordered' using errcode = 'P0001';
  end if;

  for v_item in
    select product_id, qty, unit_cost from public.purchase_items where purchase_id = p_purchase_id
  loop
    perform public.register_movement(
      v_item.product_id, p_warehouse_id, 'in', v_item.qty, v_item.unit_cost,
      'purchase', p_purchase_id::text, null
    );
  end loop;

  update public.purchase_items set received_qty = qty where purchase_id = p_purchase_id;

  -- distinct: purchase_items no es único por (purchase_id, product_id) (ver S15-01).
  insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
  select distinct v_tenant_id, v_supplier_id, pi.product_id, now()
  from public.purchase_items pi
  where pi.purchase_id = p_purchase_id
  on conflict (supplier_id, product_id)
    do update set last_purchased_at = excluded.last_purchased_at;

  update public.purchases
  set status = 'received', received_at = now()
  where id = p_purchase_id;
end;
$$;

-- 10. Una orden con algo recibido no se cancela (tampoco se edita: update_purchase ya exige
--     draft u ordered).
create or replace function public.cancel_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status text;
begin
  select tenant_id, status into v_tenant_id, v_status
  from public.purchases
  where id = p_purchase_id;

  if v_tenant_id is null then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if v_status in ('partially_received', 'received', 'cancelled') then
    raise exception 'purchase_not_cancellable' using errcode = 'P0001';
  end if;

  update public.purchases
  set status = 'cancelled'
  where id = p_purchase_id;
end;
$$;

-- 11. Deuda: una orden con facturas debe el total de sus facturas (R3); sin facturas, su total.
create or replace view public.supplier_balances as
with purchase_totals as (
  select supplier_id, coalesce(sum(coalesce(invoiced_total, total)), 0) as total_purchases
  from public.purchases
  where status in ('ordered', 'partially_received', 'received')
  group by supplier_id
),
payment_totals as (
  select supplier_id, coalesce(sum(amount), 0) as total_paid
  from public.supplier_payments
  group by supplier_id
)
select
  s.tenant_id,
  s.id as supplier_id,
  s.name as supplier_name,
  s.nit as supplier_nit,
  coalesce(pt.total_purchases, 0) as total_purchases,
  coalesce(pay.total_paid, 0) as total_paid,
  (coalesce(pt.total_purchases, 0) - coalesce(pay.total_paid, 0)) as balance
from public.suppliers s
left join purchase_totals pt on s.id = pt.supplier_id
left join payment_totals pay on s.id = pay.supplier_id
where s.tenant_id in (select public.user_tenant_ids());

create or replace function public.register_supplier_payment(
  p_supplier_id uuid,
  p_purchase_id uuid,
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
  v_sup_tenant uuid;
  v_pur_tenant uuid;
  v_pur_supplier uuid;
  v_pur_status text;
  v_pur_total numeric;
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

  select tenant_id into v_sup_tenant
  from public.suppliers
  where id = p_supplier_id and active;

  if v_sup_tenant is null then
    raise exception 'supplier_not_found' using errcode = 'P0001';
  end if;

  v_tenant_id := v_sup_tenant;

  if v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'supplier_not_found' using errcode = 'P0001';
  end if;

  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if p_purchase_id is not null then
    select tenant_id, supplier_id, status, coalesce(invoiced_total, total)
      into v_pur_tenant, v_pur_supplier, v_pur_status, v_pur_total
    from public.purchases
    where id = p_purchase_id
    for update;

    if v_pur_tenant is null or v_pur_tenant <> v_tenant_id then
      raise exception 'purchase_not_found' using errcode = 'P0001';
    end if;

    if v_pur_supplier <> p_supplier_id then
      raise exception 'purchase_supplier_mismatch' using errcode = 'P0001';
    end if;

    if v_pur_status not in ('ordered', 'partially_received', 'received') then
      raise exception 'purchase_not_payable' using errcode = 'P0001';
    end if;

    select coalesce(sum(amount), 0) into v_paid_so_far
    from public.supplier_payments
    where purchase_id = p_purchase_id;

    v_balance := v_pur_total - v_paid_so_far;

    if p_amount > v_balance then
      raise exception 'payment_exceeds_balance' using errcode = 'P0001';
    end if;
  end if;

  insert into public.supplier_payments (
    tenant_id, supplier_id, purchase_id, amount, paid_at, method, note, created_by
  ) values (
    v_tenant_id, p_supplier_id, p_purchase_id, p_amount, coalesce(p_paid_at, now()), p_method, p_note, v_user_id
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- 12. Bitácora de uso: eventos nuevos.
alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sale_created', 'sale_confirmed', 'sale_cancelled', 'payment_registered', 'cash_opened', 'cash_closed',
  'purchase_received', 'stock_adjusted', 'sale_refunded',
  'purchase_invoice_created', 'purchase_line_received', 'purchase_line_voided', 'purchase_closed_short'
));

-- 13. Archivos de facturas: bucket privado, carpeta = empresa. Sube cualquiera de la empresa;
--     lee solo dueño/admin (enlace firmado de "Ver archivo").
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('purchase-invoices', 'purchase-invoices', false, 10485760,
        array['application/pdf', 'application/xml', 'text/xml', 'application/zip',
              'application/x-zip-compressed', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "purchase_invoices_tenant_insert" on storage.objects;
create policy "purchase_invoices_tenant_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] in (select t::text from public.user_tenant_ids() t)
  );

drop policy if exists "purchase_invoices_admin_read" on storage.objects;
create policy "purchase_invoices_admin_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'purchase-invoices'
    and (storage.foldername(name))[1] in (select t::text from public.user_tenant_ids() t)
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

-- S28-02 — Al recibir con otro costo, el precio de venta mantiene el mismo % sobre el costo (P1) o
-- toma el que escribe el dueño/admin; historial de precios por proveedor y producto (P3, sin tabla
-- nueva). Ver specs/S28-02-precio-de-venta-e-historial-proveedor.md.

drop function if exists public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric);

create or replace function public.receive_purchase_line(
  p_invoice_id uuid,
  p_purchase_item_id uuid,
  p_qty numeric,
  p_unit_cost numeric default null,
  p_tax_rate numeric default null,
  p_sale_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_item record;
  v_status text;
  v_is_admin boolean;
  v_cost numeric;
  v_tax numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_price numeric;
  v_movement_id uuid;
  v_line_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;

  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  select * into v_item from public.purchase_items
  where id = p_purchase_item_id and purchase_id = v_inv.purchase_id;
  if v_item.id is null then
    raise exception 'item_invalid' using errcode = 'P0001';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty_invalid' using errcode = 'P0001';
  end if;
  if v_item.received_qty + p_qty > v_item.qty then
    raise exception 'qty_exceeds_pending' using errcode = 'P0001';
  end if;

  v_is_admin := public.user_is_tenant_admin(v_inv.tenant_id);
  if v_is_admin then
    if p_unit_cost is null or p_unit_cost < 0 or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
      raise exception 'cost_invalid' using errcode = 'P0001';
    end if;
    if p_sale_price is not null and p_sale_price < 0 then
      raise exception 'price_invalid' using errcode = 'P0001';
    end if;
    v_cost := round(p_unit_cost, 2);
    v_tax := p_tax_rate;
  else
    v_cost := v_item.unit_cost;
    v_tax := v_item.tax_rate;
  end if;

  select cost, price into v_old_cost, v_price from public.products where id = v_item.product_id for update;

  v_movement_id := public.register_movement(
    v_item.product_id, v_inv.warehouse_id, 'in', p_qty, v_cost,
    'purchase', v_inv.purchase_id::text, 'Factura ' || v_inv.number
  );

  -- P1: mismo % sobre el costo; el dueño/admin puede fijar otro precio.
  select cost into v_new_cost from public.products where id = v_item.product_id;
  if v_is_admin and p_sale_price is not null then
    update public.products set price = round(p_sale_price, 0) where id = v_item.product_id;
  elsif coalesce(v_old_cost, 0) > 0 and coalesce(v_price, 0) > 0 and v_new_cost is distinct from v_old_cost then
    update public.products set price = round(v_price * v_new_cost / v_old_cost, 0) where id = v_item.product_id;
  end if;

  insert into public.purchase_receipt_lines (
    tenant_id, invoice_id, purchase_item_id, product_id, qty, unit_cost, tax_rate, movement_id
  ) values (
    v_inv.tenant_id, p_invoice_id, p_purchase_item_id, v_item.product_id, p_qty, v_cost, v_tax, v_movement_id
  ) returning id into v_line_id;

  update public.purchase_items set received_qty = received_qty + p_qty where id = p_purchase_item_id;

  insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
  values (v_inv.tenant_id, v_inv.supplier_id, v_item.product_id, now())
  on conflict (supplier_id, product_id) do update set last_purchased_at = excluded.last_purchased_at;

  perform public.refresh_purchase_reception(v_inv.purchase_id);
  return v_line_id;
end;
$$;
revoke all on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.receive_purchase_line(uuid, uuid, numeric, numeric, numeric, numeric) to authenticated;

-- P3: historial = líneas no anuladas. security_invoker: hereda la RLS dueño/admin de S28-01.
create view public.supplier_price_history with (security_invoker = true) as
select
  h.*,
  case when h.prev_cost > 0 then round((h.unit_cost - h.prev_cost) / h.prev_cost * 100, 2) end as change_percent
from (
  select
    l.id as line_id,
    l.tenant_id,
    i.supplier_id,
    s.name as supplier_name,
    l.product_id,
    p.name as product_name,
    i.number as invoice_number,
    i.issued_on,
    l.qty,
    l.unit_cost,
    l.created_at,
    lag(l.unit_cost) over (partition by i.supplier_id, l.product_id order by i.issued_on, l.created_at) as prev_cost
  from public.purchase_receipt_lines l
  join public.purchase_invoices i on i.id = l.invoice_id
  join public.suppliers s on s.id = i.supplier_id
  join public.products p on p.id = l.product_id
  where l.voided_at is null
) h;
grant select on public.supplier_price_history to authenticated;

-- S28-03 — Corregir o anular facturas de proveedor (deuda = facturas activas, nunca menor a lo
-- pagado) y anular líneas sin dejar valor sobrante en el kardex (F4). Costo: promedio ponderado
-- (ADR-038, asumido como respuesta de la contadora). Ver specs/S28-03-corregir-factura-y-anulacion-coherente.md.

alter table public.purchase_invoices
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id);

-- El número de una factura anulada se puede volver a usar.
drop index if exists public.purchase_invoices_number_uidx;
create unique index purchase_invoices_number_uidx
  on public.purchase_invoices (tenant_id, supplier_id, lower(btrim(number)))
  where voided_at is null;

-- F3: deuda = suma de facturas activas (null sin facturas → total de la orden), nunca menor a lo
-- pagado. Al lanzar, la transacción de la RPC que la llama se deshace entera.
create or replace function public.refresh_purchase_invoiced_total(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt numeric;
begin
  update public.purchases p
  set invoiced_total = (
    select sum(total) from public.purchase_invoices where purchase_id = p.id and voided_at is null
  )
  where p.id = p_purchase_id
  returning coalesce(p.invoiced_total, p.total) into v_debt;

  if (select coalesce(sum(amount), 0) from public.supplier_payments where purchase_id = p_purchase_id) > v_debt then
    raise exception 'invoice_below_payments' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.refresh_purchase_invoiced_total(uuid) from public, anon, authenticated;

-- create_purchase_invoice: el número se compara solo con facturas activas.
create or replace function public.create_purchase_invoice(
  p_purchase_id uuid,
  p_number text,
  p_issued_on date,
  p_due_on date,
  p_cufe text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_warehouse_id uuid,
  p_file_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_supplier_id uuid;
  v_status text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select tenant_id, supplier_id, status into v_tenant_id, v_supplier_id, v_status
  from public.purchases where id = p_purchase_id for update;
  if v_tenant_id is null or v_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = v_tenant_id) then
    raise exception 'warehouse_invalid' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_number), '') = '' or p_issued_on is null then
    raise exception 'invoice_invalid' using errcode = 'P0001';
  end if;
  if p_subtotal is null or p_tax is null or p_total is null
     or p_subtotal < 0 or p_tax < 0 or p_total <> p_subtotal + p_tax then
    raise exception 'invoice_totals_invalid' using errcode = 'P0001';
  end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> v_tenant_id::text then
    raise exception 'invoice_file_invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.purchase_invoices
    where tenant_id = v_tenant_id and supplier_id = v_supplier_id and voided_at is null
      and lower(btrim(number)) = lower(btrim(p_number))
  ) then
    raise exception 'invoice_number_taken' using errcode = 'P0001';
  end if;

  insert into public.purchase_invoices (
    tenant_id, purchase_id, supplier_id, number, issued_on, due_on, cufe, subtotal, tax, total, warehouse_id, file_path
  ) values (
    v_tenant_id, p_purchase_id, v_supplier_id, btrim(p_number), p_issued_on, p_due_on, nullif(btrim(p_cufe), ''),
    p_subtotal, p_tax, p_total, p_warehouse_id, p_file_path
  ) returning id into v_id;

  perform public.refresh_purchase_invoiced_total(p_purchase_id);
  return v_id;
end;
$$;

-- F1: corregir (dueño/admin). p_file_path null = conserva el archivo. La bodega no cambia.
create or replace function public.update_purchase_invoice(
  p_invoice_id uuid,
  p_number text,
  p_issued_on date,
  p_due_on date,
  p_cufe text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_file_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_status text;
begin
  select * into v_inv from public.purchase_invoices where id = p_invoice_id for update;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
  if not public.user_is_tenant_admin(v_inv.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_inv.voided_at is not null then
    raise exception 'invoice_voided' using errcode = 'P0001';
  end if;
  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status = 'cancelled' then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_number), '') = '' or p_issued_on is null then
    raise exception 'invoice_invalid' using errcode = 'P0001';
  end if;
  if p_subtotal is null or p_tax is null or p_total is null
     or p_subtotal < 0 or p_tax < 0 or p_total <> p_subtotal + p_tax then
    raise exception 'invoice_totals_invalid' using errcode = 'P0001';
  end if;
  if p_file_path is not null and split_part(p_file_path, '/', 1) <> v_inv.tenant_id::text then
    raise exception 'invoice_file_invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.purchase_invoices
    where tenant_id = v_inv.tenant_id and supplier_id = v_inv.supplier_id and voided_at is null
      and id <> p_invoice_id and lower(btrim(number)) = lower(btrim(p_number))
  ) then
    raise exception 'invoice_number_taken' using errcode = 'P0001';
  end if;

  update public.purchase_invoices
  set number = btrim(p_number), issued_on = p_issued_on, due_on = p_due_on, cufe = nullif(btrim(p_cufe), ''),
      subtotal = p_subtotal, tax = p_tax, total = p_total, file_path = coalesce(p_file_path, file_path)
  where id = p_invoice_id;

  perform public.refresh_purchase_invoiced_total(v_inv.purchase_id);
end;
$$;
revoke all on function public.update_purchase_invoice(uuid, text, date, date, text, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.update_purchase_invoice(uuid, text, date, date, text, numeric, numeric, numeric, text) to authenticated;

-- F2: anular una factura sin líneas activas (dueño/admin). Queda guardada como anulada.
create or replace function public.void_purchase_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select * into v_inv from public.purchase_invoices where id = p_invoice_id for update;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'invoice_not_found' using errcode = 'P0001';
  end if;
  if not public.user_is_tenant_admin(v_inv.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_inv.voided_at is not null then
    raise exception 'invoice_voided' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.purchase_receipt_lines where invoice_id = p_invoice_id and voided_at is null) then
    raise exception 'invoice_has_lines' using errcode = 'P0001';
  end if;

  perform 1 from public.purchases where id = v_inv.purchase_id for update;
  update public.purchase_invoices set voided_at = now(), voided_by = auth.uid() where id = p_invoice_id;
  perform public.refresh_purchase_invoiced_total(v_inv.purchase_id);
end;
$$;
revoke all on function public.void_purchase_invoice(uuid) from public, anon;
grant execute on function public.void_purchase_invoice(uuid) to authenticated;

-- receive_purchase_line (S28-02) + una factura anulada no admite líneas.
create or replace function public.receive_purchase_line(
  p_invoice_id uuid,
  p_purchase_item_id uuid,
  p_qty numeric,
  p_unit_cost numeric default null,
  p_tax_rate numeric default null,
  p_sale_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_item record;
  v_status text;
  v_is_admin boolean;
  v_cost numeric;
  v_tax numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_price numeric;
  v_movement_id uuid;
  v_line_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'purchase_not_found' using errcode = 'P0001';
  end if;
  if v_inv.voided_at is not null then
    raise exception 'invoice_voided' using errcode = 'P0001';
  end if;

  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status not in ('ordered', 'partially_received') then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  select * into v_item from public.purchase_items
  where id = p_purchase_item_id and purchase_id = v_inv.purchase_id;
  if v_item.id is null then
    raise exception 'item_invalid' using errcode = 'P0001';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty_invalid' using errcode = 'P0001';
  end if;
  if v_item.received_qty + p_qty > v_item.qty then
    raise exception 'qty_exceeds_pending' using errcode = 'P0001';
  end if;

  v_is_admin := public.user_is_tenant_admin(v_inv.tenant_id);
  if v_is_admin then
    if p_unit_cost is null or p_unit_cost < 0 or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
      raise exception 'cost_invalid' using errcode = 'P0001';
    end if;
    if p_sale_price is not null and p_sale_price < 0 then
      raise exception 'price_invalid' using errcode = 'P0001';
    end if;
    v_cost := round(p_unit_cost, 2);
    v_tax := p_tax_rate;
  else
    v_cost := v_item.unit_cost;
    v_tax := v_item.tax_rate;
  end if;

  select cost, price into v_old_cost, v_price from public.products where id = v_item.product_id for update;

  v_movement_id := public.register_movement(
    v_item.product_id, v_inv.warehouse_id, 'in', p_qty, v_cost,
    'purchase', v_inv.purchase_id::text, 'Factura ' || v_inv.number
  );

  -- P1: mismo % sobre el costo; el dueño/admin puede fijar otro precio.
  select cost into v_new_cost from public.products where id = v_item.product_id;
  if v_is_admin and p_sale_price is not null then
    update public.products set price = round(p_sale_price, 0) where id = v_item.product_id;
  elsif coalesce(v_old_cost, 0) > 0 and coalesce(v_price, 0) > 0 and v_new_cost is distinct from v_old_cost then
    update public.products set price = round(v_price * v_new_cost / v_old_cost, 0) where id = v_item.product_id;
  end if;

  insert into public.purchase_receipt_lines (
    tenant_id, invoice_id, purchase_item_id, product_id, qty, unit_cost, tax_rate, movement_id
  ) values (
    v_inv.tenant_id, p_invoice_id, p_purchase_item_id, v_item.product_id, p_qty, v_cost, v_tax, v_movement_id
  ) returning id into v_line_id;

  update public.purchase_items set received_qty = received_qty + p_qty where id = p_purchase_item_id;

  insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
  values (v_inv.tenant_id, v_inv.supplier_id, v_item.product_id, now())
  on conflict (supplier_id, product_id) do update set last_purchased_at = excluded.last_purchased_at;

  perform public.refresh_purchase_reception(v_inv.purchase_id);
  return v_line_id;
end;
$$;

-- F4: anular una línea sale al costo de entrada, salvo que deje el producto en 0 (sale todo el
-- valor que queda) o con valor negativo (sale al promedio). Así el kardex nunca queda con valor
-- sobrante sin stock.
create or replace function public.void_purchase_receipt_line(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_inv record;
  v_status text;
  v_wh_stock numeric;
  v_qty numeric;
  v_value numeric;
  v_exit_cost numeric;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_line from public.purchase_receipt_lines where id = p_line_id for update;
  if v_line.id is null or v_line.tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'line_not_found' using errcode = 'P0001';
  end if;
  if not public.user_is_tenant_admin(v_line.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_line.voided_at is not null then
    raise exception 'line_already_voided' using errcode = 'P0001';
  end if;

  select * into v_inv from public.purchase_invoices where id = v_line.invoice_id;
  select status into v_status from public.purchases where id = v_inv.purchase_id for update;
  if v_status = 'cancelled' then
    raise exception 'purchase_not_receivable' using errcode = 'P0001';
  end if;

  perform 1 from public.products where id = v_line.product_id for update;
  select coalesce(sum(qty), 0) into v_wh_stock from public.stock_movements
  where product_id = v_line.product_id and warehouse_id = v_inv.warehouse_id;
  if v_wh_stock < v_line.qty then
    raise exception 'stock_insufficient' using errcode = 'P0001';
  end if;

  select coalesce(sum(qty), 0), coalesce(sum(qty * unit_cost), 0) into v_qty, v_value
  from public.stock_movements where product_id = v_line.product_id;

  v_exit_cost := v_line.unit_cost;
  if v_qty - v_line.qty <= 0 then
    v_exit_cost := round(v_value / v_line.qty, 2);
  elsif v_value - v_line.qty * v_exit_cost < 0 then
    v_exit_cost := round(v_value / v_qty, 2);
  end if;

  insert into public.stock_movements (
    tenant_id, product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, created_by
  ) values (
    v_line.tenant_id, v_line.product_id, v_inv.warehouse_id, 'out', -v_line.qty, v_exit_cost,
    'purchase', v_inv.purchase_id::text, 'Anulación factura ' || v_inv.number, auth.uid()
  );

  -- Costo promedio sin esa entrada (mismo cálculo que register_movement).
  update public.products p
  set cost = round(k.value / k.qty, 2)
  from (
    select sum(qty) as qty, sum(qty * unit_cost) as value
    from public.stock_movements where product_id = v_line.product_id
  ) k
  where p.id = v_line.product_id and k.qty > 0;

  update public.purchase_receipt_lines set voided_at = now(), voided_by = auth.uid() where id = p_line_id;
  update public.purchase_items set received_qty = received_qty - v_line.qty where id = v_line.purchase_item_id;
  perform public.refresh_purchase_reception(v_inv.purchase_id);
end;
$$;

alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sale_created', 'sale_confirmed', 'sale_cancelled', 'payment_registered', 'cash_opened', 'cash_closed',
  'purchase_received', 'stock_adjusted', 'sale_refunded',
  'purchase_invoice_created', 'purchase_line_received', 'purchase_line_voided', 'purchase_closed_short',
  'purchase_invoice_updated', 'purchase_invoice_voided'
));

commit;
