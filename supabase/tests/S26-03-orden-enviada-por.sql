-- S26-03 — "Enviada por": quien marca la orden como ordenada (o la crea ordenada) firma con su
-- nombre en purchases.ordered_by_name. Ver specs/S26-03-pdf-orden-de-compra.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026301', 'owner-s2603@test.local'),
  ('00000000-0000-0000-0000-000000026302', 'admin-s2603@test.local');

insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000026301', 'Tenant S26-03');

insert into public.memberships (user_id, tenant_id, role, display_name, created_by) values
  ('00000000-0000-0000-0000-000000026301', '10000000-0000-0000-0000-000000026301', 'owner', 'Dueña',
   '00000000-0000-0000-0000-000000026301'),
  ('00000000-0000-0000-0000-000000026302', '10000000-0000-0000-0000-000000026301', 'admin', null,
   '00000000-0000-0000-0000-000000026301');

-- S26-08: el nombre que firma sale de RRHH (trabajador conectado a la cuenta).
insert into public.workers (tenant_id, full_name, doc_number, user_id, created_by)
select tenant_id, display_name, user_id::text, user_id, user_id from public.memberships
where display_name is not null and user_id in (select id from auth.users where email like '%s2603%');

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000026301', '10000000-0000-0000-0000-000000026301', 'Proveedor',
   '00000000-0000-0000-0000-000000026301');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-000000026301', '10000000-0000-0000-0000-000000026301', 'SKU-S2603',
   'Producto', 100, 200, '00000000-0000-0000-0000-000000026301');

-- Orden aprobada en borrador, pedida por la dueña.
insert into public.purchases (id, tenant_id, supplier_id, status, created_by, approved_at, approved_by_name)
values ('50000000-0000-0000-0000-000000026301', '10000000-0000-0000-0000-000000026301',
        '20000000-0000-0000-0000-000000026301', 'draft', '00000000-0000-0000-0000-000000026301',
        now(), 'Dueña');

-- === C4: sin "Tu nombre" no se marca ordenada ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026302", "role": "authenticated"}';
select throws_ok(
  $$select public.mark_purchase_ordered('50000000-0000-0000-0000-000000026301'::uuid)$$,
  'P0001', 'display_name_required', 'C4: sin nombre no marca ordenada');
select is((select status from public.purchases where id = '50000000-0000-0000-0000-000000026301'),
  'draft', 'C4: la orden sigue en borrador');

-- === C4: quien marca ordenada firma "enviada por" ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026301", "role": "authenticated"}';
select lives_ok(
  $$select public.mark_purchase_ordered('50000000-0000-0000-0000-000000026301'::uuid)$$,
  'C4: la dueña marca ordenada');
select is((select ordered_by_name from public.purchases where id = '50000000-0000-0000-0000-000000026301'),
  'Dueña', 'C4: queda su nombre como "enviada por"');

-- === C4: crear y ordenar también firma; crear en borrador no ===
select lives_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026301', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026301", "qty": 1, "unit_cost": 100}]'::jsonb)$$,
  'C4: la dueña crea y ordena');
select is(
  (select ordered_by_name from public.purchases
   where status = 'ordered' and id <> '50000000-0000-0000-0000-000000026301'),
  'Dueña', 'C4: crear y ordenar firma "enviada por"');
select lives_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026301', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-000000026301", "qty": 1, "unit_cost": 100}]'::jsonb)$$,
  'C4: la dueña crea un borrador');
select is((select ordered_by_name from public.purchases where status = 'draft'),
  null, 'C4: un borrador no tiene "enviada por"');

select * from finish();
rollback;
