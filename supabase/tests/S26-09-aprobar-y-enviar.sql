-- S26-09 — Orden de compra más rápida: "Aprobar y enviar" en un paso (approve_purchase deja la orden
-- ordenada) y un aprobador que edita una orden enviada la deja enviada.
-- Ver specs/S26-09-aprobar-y-enviar.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026901', 'duena-s2609@test.local'),
  ('00000000-0000-0000-0000-000000026902', 'pide-s2609@test.local');
insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000026901', 'A');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000026901', '10000000-0000-0000-0000-000000026901', 'owner', '00000000-0000-0000-0000-000000026901'),
  ('00000000-0000-0000-0000-000000026902', '10000000-0000-0000-0000-000000026901', 'admin', '00000000-0000-0000-0000-000000026901');
insert into public.workers (tenant_id, full_name, doc_number, user_id, created_by) values
  ('10000000-0000-0000-0000-000000026901', 'Dueña', '1', '00000000-0000-0000-0000-000000026901', '00000000-0000-0000-0000-000000026901'),
  ('10000000-0000-0000-0000-000000026901', 'Pide', '2', '00000000-0000-0000-0000-000000026902', '00000000-0000-0000-0000-000000026901');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000026901', '10000000-0000-0000-0000-000000026901', 'P', '00000000-0000-0000-0000-000000026901');
insert into public.products (id, tenant_id, sku, name, created_by) values
  ('30000000-0000-0000-0000-000000026901', '10000000-0000-0000-0000-000000026901', 'A', 'A', '00000000-0000-0000-0000-000000026901');

set local role authenticated;
create temp table t_p (k text primary key, id uuid) on commit drop;
grant all on t_p to authenticated;

-- Quien no aprueba pide aprobación.
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026902", "role": "authenticated"}';
insert into t_p select 'pedida', public.create_purchase('20000000-0000-0000-0000-000000026901', 'draft',
  '[{"product_id": "30000000-0000-0000-0000-000000026901", "qty": 1, "unit_cost": 100}]'::jsonb, null);

-- C2: "Aprobar y enviar" en un paso.
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026901", "role": "authenticated"}';
select lives_ok(format($$select public.approve_purchase('%s')$$, (select id from t_p where k = 'pedida')),
  'C2: el aprobador aprueba y envía en un paso');
select results_eq(
  format($$select status, approved_by_name, ordered_by_name, issued_at is not null from public.purchases where id = '%s'$$,
         (select id from t_p where k = 'pedida')),
  $$values ('ordered'::text, 'Dueña'::text, 'Dueña'::text, true)$$,
  'C2: queda enviada, firmada como aprobada y enviada');

-- C2: un borrador del propio aprobador (ya aprobado) también se envía con el mismo botón.
insert into t_p select 'borrador', public.create_purchase('20000000-0000-0000-0000-000000026901', 'draft',
  '[{"product_id": "30000000-0000-0000-0000-000000026901", "qty": 1, "unit_cost": 100}]'::jsonb, null);
select lives_ok(format($$select public.approve_purchase('%s')$$, (select id from t_p where k = 'borrador')),
  'C2: su propio borrador se envía con "Aprobar y enviar"');
select is((select status from public.purchases where id = (select id from t_p where k = 'borrador')),
  'ordered', 'C2: queda enviada');
select throws_ok(format($$select public.approve_purchase('%s')$$, (select id from t_p where k = 'borrador')),
  'P0001', 'purchase_not_pending', 'C2: una enviada no se vuelve a aprobar');

-- C4: el aprobador edita una enviada → sigue enviada.
select public.update_purchase((select id from t_p where k = 'borrador'), '20000000-0000-0000-0000-000000026901',
  '[{"product_id": "30000000-0000-0000-0000-000000026901", "qty": 3, "unit_cost": 100}]'::jsonb, null);
select results_eq(
  format($$select status, issued_at is not null, total from public.purchases where id = '%s'$$, (select id from t_p where k = 'borrador')),
  $$values ('ordered'::text, true, 300.00::numeric)$$,
  'C4: editada por un aprobador sigue enviada, con los cambios');

-- C4: si la edita quien no aprueba, vuelve a pendiente.
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026902", "role": "authenticated"}';
select public.update_purchase((select id from t_p where k = 'borrador'), '20000000-0000-0000-0000-000000026901',
  '[{"product_id": "30000000-0000-0000-0000-000000026901", "qty": 4, "unit_cost": 100}]'::jsonb, null);
select ok((select status = 'draft' and approved_at is null and issued_at is null
           from public.purchases where id = (select id from t_p where k = 'borrador')),
  'C4: editada por quien no aprueba vuelve a pendiente');
select throws_ok(format($$select public.approve_purchase('%s')$$, (select id from t_p where k = 'borrador')),
  'P0001', 'permission_denied', 'C3: quien no aprueba no puede aprobar y enviar');

select * from finish();
rollback;
