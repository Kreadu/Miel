-- S5-07 — Interacciones postventa CRM: tabla customer_interactions append-only.
-- RLS: select + insert abiertos a todo el tenant (owner/admin/member); sin update/delete.
-- Ver specs/S5-07-interacciones-crm.md, docs/arch/permisos-roles.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixtures: tenant A (owner + member) y tenant B (owner), un cliente por tenant
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000eea1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000eea2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000eeb1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000eea1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000eeb1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000eea1', '10000000-0000-0000-0000-00000000eea1', 'owner',
   '00000000-0000-0000-0000-00000000eea1'),
  ('00000000-0000-0000-0000-00000000eea2', '10000000-0000-0000-0000-00000000eea1', 'member',
   '00000000-0000-0000-0000-00000000eea1'),
  ('00000000-0000-0000-0000-00000000eeb1', '10000000-0000-0000-0000-00000000eeb1', 'owner',
   '00000000-0000-0000-0000-00000000eeb1');

insert into public.customers (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-00000000eea1', '10000000-0000-0000-0000-00000000eea1',
   'Cliente A', '00000000-0000-0000-0000-00000000eea1'),
  ('30000000-0000-0000-0000-00000000eeb1', '10000000-0000-0000-0000-00000000eeb1',
   'Cliente B', '00000000-0000-0000-0000-00000000eeb1');

-- === C1: member del tenant A registra una interacción (INSERT abierto a todo el tenant) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000eea2", "role": "authenticated"}';

insert into public.customer_interactions (tenant_id, customer_id, kind, note) values
  ('10000000-0000-0000-0000-00000000eea1', '30000000-0000-0000-0000-00000000eea1',
   'complaint', 'Cliente reporta demora en la entrega');

select is(
  (select count(*)::int from public.customer_interactions
   where tenant_id = '10000000-0000-0000-0000-00000000eea1'),
  1, 'C1: member registra una interacción en su tenant');

select is(
  (select created_by from public.customer_interactions
   where tenant_id = '10000000-0000-0000-0000-00000000eea1'),
  '00000000-0000-0000-0000-00000000eea2'::uuid,
  'C1: created_by queda en el autor real de la interacción');

-- === C2: kind fuera del dominio cerrado es rechazado por el CHECK de BD ===
select throws_ok(
  $$insert into public.customer_interactions (tenant_id, customer_id, kind, note)
    values ('10000000-0000-0000-0000-00000000eea1', '30000000-0000-0000-0000-00000000eea1',
            'invalid_kind', 'nota')$$,
  '23514', null, 'C2: kind fuera de note|followup|complaint|promo es rechazado (CHECK)');

-- === C4: orden cronológico descendente ===
insert into public.customer_interactions (tenant_id, customer_id, kind, note, occurred_at) values
  ('10000000-0000-0000-0000-00000000eea1', '30000000-0000-0000-0000-00000000eea1',
   'followup', 'Segunda interacción, más reciente', now() + interval '1 hour');

select is(
  (select kind from public.customer_interactions
   where tenant_id = '10000000-0000-0000-0000-00000000eea1'
   order by occurred_at desc limit 1),
  'followup', 'C4: la interacción más reciente queda primera al ordenar por occurred_at desc');

select has_trigger('public', 'customer_interactions', 'customer_interactions_set_updated_at',
  'trigger set_updated_at existe sobre customer_interactions');

-- === C3: aislamiento — owner de B no ve las interacciones del cliente de A ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000eeb1", "role": "authenticated"}';

select is(
  (select count(*)::int from public.customer_interactions
   where tenant_id = '10000000-0000-0000-0000-00000000eea1'),
  0, 'C3: owner de B no ve las interacciones del tenant A');

-- === C3: owner de B no puede insertar en el tenant A ===
select throws_ok(
  $$insert into public.customer_interactions (tenant_id, customer_id, kind, note)
    values ('10000000-0000-0000-0000-00000000eea1', '30000000-0000-0000-0000-00000000eea1',
            'note', 'intrusa')$$,
  '42501', null, 'C3: owner de B no puede insertar en el tenant A');

-- === C5: append-only — nadie puede actualizar una interacción existente (sin política UPDATE) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000eea1", "role": "authenticated"}';

select throws_ok(
  $$update public.customer_interactions set note = 'editada'
    where tenant_id = '10000000-0000-0000-0000-00000000eea1' and kind = 'complaint'$$,
  '42501', null, 'C5: append-only — UPDATE rechazado, sin política de escritura posterior');

-- === C5: append-only — nadie puede borrar una interacción existente (sin política DELETE) ===
select throws_ok(
  $$delete from public.customer_interactions
    where tenant_id = '10000000-0000-0000-0000-00000000eea1' and kind = 'complaint'$$,
  '42501', null, 'C5: append-only — DELETE rechazado, sin política de borrado');

select * from finish();
rollback;
