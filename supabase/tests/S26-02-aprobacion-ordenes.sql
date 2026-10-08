-- S26-02 — Aprobación de órdenes de compra: aprobadores (solo el dueño marca admins), número
-- consecutivo por empresa, firmas pedida/aprobada, gate de aprobación en ordered.
-- Ver specs/S26-02-aprobacion-ordenes-de-compra.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Fixtures: tenant A (dueña, admin aprobador, admin que pide, admin sin nombre, operativo) y B.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026201', 'owner-s2602@test.local'),
  ('00000000-0000-0000-0000-000000026202', 'aprobador-s2602@test.local'),
  ('00000000-0000-0000-0000-000000026203', 'pide-s2602@test.local'),
  ('00000000-0000-0000-0000-000000026204', 'sinnombre-s2602@test.local'),
  ('00000000-0000-0000-0000-000000026205', 'member-s2602@test.local'),
  ('00000000-0000-0000-0000-000000026206', 'owner-b-s2602@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000026201', 'Tenant S26-02'),
  ('10000000-0000-0000-0000-000000026202', 'Tenant B S26-02');

insert into public.memberships (id, user_id, tenant_id, role, display_name, created_by) values
  ('60000000-0000-0000-0000-000000026201', '00000000-0000-0000-0000-000000026201',
   '10000000-0000-0000-0000-000000026201', 'owner', 'Dueña', '00000000-0000-0000-0000-000000026201'),
  ('60000000-0000-0000-0000-000000026202', '00000000-0000-0000-0000-000000026202',
   '10000000-0000-0000-0000-000000026201', 'admin', 'Aprobador', '00000000-0000-0000-0000-000000026201'),
  ('60000000-0000-0000-0000-000000026203', '00000000-0000-0000-0000-000000026203',
   '10000000-0000-0000-0000-000000026201', 'admin', 'Pide', '00000000-0000-0000-0000-000000026201'),
  ('60000000-0000-0000-0000-000000026204', '00000000-0000-0000-0000-000000026204',
   '10000000-0000-0000-0000-000000026201', 'admin', null, '00000000-0000-0000-0000-000000026201'),
  ('60000000-0000-0000-0000-000000026205', '00000000-0000-0000-0000-000000026205',
   '10000000-0000-0000-0000-000000026201', 'member', 'Operativo', '00000000-0000-0000-0000-000000026201'),
  ('60000000-0000-0000-0000-000000026206', '00000000-0000-0000-0000-000000026206',
   '10000000-0000-0000-0000-000000026202', 'owner', 'Dueño B', '00000000-0000-0000-0000-000000026206');

-- S26-08: el nombre que firma sale de RRHH (trabajador conectado a la cuenta).
insert into public.workers (tenant_id, full_name, doc_number, user_id, created_by)
select tenant_id, display_name, user_id::text, user_id, user_id from public.memberships
where display_name is not null and user_id in (select id from auth.users where email like '%-s2602@test.local');

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000026201', '10000000-0000-0000-0000-000000026201',
   'Proveedor A', '00000000-0000-0000-0000-000000026201'),
  ('20000000-0000-0000-0000-000000026202', '10000000-0000-0000-0000-000000026202',
   'Proveedor B', '00000000-0000-0000-0000-000000026206');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-000000026201', '10000000-0000-0000-0000-000000026201',
   'SKU-S2602', 'Producto A', 100, 200, '00000000-0000-0000-0000-000000026201');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000026201', '10000000-0000-0000-0000-000000026201', 'Bodega A',
   '00000000-0000-0000-0000-000000026201');

-- Orden "vieja" ya ordenada sin aprobación (como las anteriores a la migración) + una de B.
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('50000000-0000-0000-0000-000000026201', '10000000-0000-0000-0000-000000026201',
   '20000000-0000-0000-0000-000000026201', 'ordered', now(), '00000000-0000-0000-0000-000000026201'),
  ('50000000-0000-0000-0000-000000026202', '10000000-0000-0000-0000-000000026202',
   '20000000-0000-0000-0000-000000026202', 'ordered', now(), '00000000-0000-0000-0000-000000026206');
insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost) values
  ('10000000-0000-0000-0000-000000026201', '50000000-0000-0000-0000-000000026201',
   '30000000-0000-0000-0000-000000026201', 1, 100);

-- === C5: número asignado aunque se inserte directo; cada empresa empieza en 1 ===
select is((select number from public.purchases where id = '50000000-0000-0000-0000-000000026201'),
  1, 'C5: la primera orden de A es la 1');
select is((select number from public.purchases where id = '50000000-0000-0000-0000-000000026202'),
  1, 'C5: la primera orden de B también es la 1');

-- === C1: solo el dueño marca aprobadores ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026202", "role": "authenticated"}';

select throws_ok(
  $$select public.set_purchase_approver('60000000-0000-0000-0000-000000026202', true)$$,
  'P0001', 'permission_denied', 'C1: un admin no se marca a sí mismo');
select throws_ok(
  $$update public.memberships set can_approve_purchases = true
    where id = '60000000-0000-0000-0000-000000026202'$$,
  'P0001', 'permission_denied', 'C1: tampoco con un update directo (trigger lo impide)');
select is((select count(*)::int from public.purchase_counters), 1, 'C1: A solo ve su contador');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026201", "role": "authenticated"}';
select throws_ok(
  $$select public.set_purchase_approver('60000000-0000-0000-0000-000000026205', true)$$,
  'P0001', 'approver_invalid', 'C1: un operativo no puede ser aprobador');
select throws_ok(
  $$select public.set_purchase_approver('60000000-0000-0000-0000-000000026201', false)$$,
  'P0001', 'approver_invalid', 'C1: al dueño no se le desmarca');
select throws_ok(
  $$select public.set_purchase_approver('60000000-0000-0000-0000-000000026206', true)$$,
  'P0001', 'permission_denied', 'C1: no toca membresías de otra empresa');
select lives_ok(
  $$select public.set_purchase_approver('60000000-0000-0000-0000-000000026202', true)$$,
  'C1: la dueña marca al admin como aprobador');
select is((select can_approve_purchases from public.memberships where id = '60000000-0000-0000-0000-000000026202'),
  true, 'C1: queda marcado');

-- === C2: admin que no aprueba pide → pendiente, numerada, sin poder ordenarla ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026203", "role": "authenticated"}';
select throws_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026201', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 1, "unit_cost": 100}]'::jsonb)$$,
  'P0001', 'approval_required', 'C2: sin aprobar no puede crear y ordenar');
select lives_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026201', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 1, "unit_cost": 100}]'::jsonb)$$,
  'C2: crea la orden en borrador');
select is((select number from public.purchases where requested_by_name = 'Pide'), 2,
  'C2: recibe el siguiente número (2)');
select ok((select requested_at is not null and approved_at is null from public.purchases where number = 2
  and tenant_id = '10000000-0000-0000-0000-000000026201'),
  'C2: firmada como pedida, pendiente de aprobación');
select throws_ok(
  format($$select public.mark_purchase_ordered('%s'::uuid)$$,
    (select id from public.purchases where requested_by_name = 'Pide')),
  'P0001', 'approval_required', 'C2: no se marca ordenada sin aprobación');
select throws_ok(
  format($$select public.approve_purchase('%s'::uuid)$$,
    (select id from public.purchases where requested_by_name = 'Pide')),
  'P0001', 'permission_denied', 'C2: quien no es aprobador no aprueba');

-- === C4: sin "Tu nombre" no pide ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026204", "role": "authenticated"}';
select throws_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026201', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 1, "unit_cost": 100}]'::jsonb)$$,
  'P0001', 'display_name_required', 'C4: sin nombre no se crea la orden');
select is((select count(*)::int from public.purchases where tenant_id = '10000000-0000-0000-0000-000000026201'),
  2, 'C4: no quedó orden a medias');

-- === C3: el aprobador aprueba y luego se puede ordenar ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026202", "role": "authenticated"}';
select lives_ok(
  format($$select public.approve_purchase('%s'::uuid)$$,
    (select id from public.purchases where requested_by_name = 'Pide')),
  'C3: el aprobador aprueba');
select is((select approved_by_name from public.purchases where requested_by_name = 'Pide'), 'Aprobador',
  'C3: queda su nombre como aprobador');
select throws_ok(
  format($$select public.approve_purchase('%s'::uuid)$$,
    (select id from public.purchases where requested_by_name = 'Pide')),
  'P0001', 'purchase_not_pending', 'C3: no se aprueba dos veces');
select is((select status from public.purchases where requested_by_name = 'Pide'), 'ordered',
  'C3 (S26-09): aprobar la deja enviada en el mismo paso');

-- === C3 (A5): editar una aprobada la devuelve a pendiente ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026203", "role": "authenticated"}';
select lives_ok(
  format($$select public.update_purchase('%s'::uuid, '20000000-0000-0000-0000-000000026201'::uuid,
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 5, "unit_cost": 100}]'::jsonb)$$,
    (select id from public.purchases where requested_by_name = 'Pide')),
  'C3: quien pidió la edita');
select ok((select status = 'draft' and approved_at is null and approved_by_name is null and issued_at is null
  from public.purchases where requested_by_name = 'Pide'),
  'C3: editada por quien no aprueba vuelve a borrador pendiente de aprobación');

-- === C3 (A2): si la crea un aprobador nace aprobada y puede crear y ordenar ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026201", "role": "authenticated"}';
select lives_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026201', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 1, "unit_cost": 100}]'::jsonb)$$,
  'C3: la dueña crea y ordena de una vez');
select ok((select status = 'ordered' and approved_by_name = 'Dueña' and requested_by_name = 'Dueña'
  from public.purchases where number = 3 and tenant_id = '10000000-0000-0000-0000-000000026201'),
  'C3: nace aprobada con su nombre en las dos firmas');
select lives_ok(
  format($$select public.update_purchase('%s'::uuid, '20000000-0000-0000-0000-000000026201'::uuid,
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 2, "unit_cost": 100}]'::jsonb)$$,
    (select id from public.purchases where requested_by_name = 'Pide')),
  'C3: la dueña edita la pendiente');
select is((select approved_by_name from public.purchases where requested_by_name = 'Pide'), 'Dueña',
  'C3: editada por un aprobador queda aprobada otra vez');

-- === Borde: una orden con un pago ligado no se edita (saldría de las cuentas por pagar) ===
reset role;
insert into public.supplier_payments (tenant_id, supplier_id, purchase_id, amount, method, created_by)
values ('10000000-0000-0000-0000-000000026201', '20000000-0000-0000-0000-000000026201',
        '50000000-0000-0000-0000-000000026201', 50, 'cash', '00000000-0000-0000-0000-000000026201');
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026201", "role": "authenticated"}';
select throws_ok(
  $$select public.update_purchase('50000000-0000-0000-0000-000000026201'::uuid,
      '20000000-0000-0000-0000-000000026201'::uuid,
      '[{"product_id": "30000000-0000-0000-0000-000000026201", "qty": 9, "unit_cost": 100}]'::jsonb)$$,
  'P0001', 'purchase_has_payments', 'Borde: con pagos ligados no se edita');

-- === C5: la orden vieja ordenada se recibe sin aprobación; tenant ajeno no se aprueba ===
select lives_ok(
  $$select public.receive_purchase('50000000-0000-0000-0000-000000026201'::uuid,
      '40000000-0000-0000-0000-000000026201'::uuid)$$,
  'C5: una orden vieja ordenada se recibe sin aprobación');
select throws_ok(
  $$select public.approve_purchase('50000000-0000-0000-0000-000000026202'::uuid)$$,
  'P0001', 'permission_denied', 'C5: no aprueba órdenes de otra empresa');

select * from finish();
rollback;
