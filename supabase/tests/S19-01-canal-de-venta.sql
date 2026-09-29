-- S19-01 — Canal de venta del tenant: fisica y/o virtual, combinables.
-- Ver specs/S19-01-canal-de-venta-fisica-virtual.md, ADR-034.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f0001', 'fisica@test.local'),
  ('00000000-0000-0000-0000-0000000f0002', 'virtual@test.local'),
  ('00000000-0000-0000-0000-0000000f0003', 'ambos@test.local'),
  ('00000000-0000-0000-0000-0000000f0004', 'ninguno@test.local');

-- === C1: sin especificar canal, default = solo fisica (retrocompatibilidad) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000f0001", "role": "authenticated"}';

select isnt(
  (select public.create_tenant_with_owner('Tienda Fisica')),
  null,
  'C1: crea tenant sin especificar canal');

select is(
  (select row(sells_physical, sells_virtual) from public.tenants where name = 'Tienda Fisica'),
  row(true, false),
  'C1: default es solo fisica (sells_physical=true, sells_virtual=false)');

-- === C2: solo virtual ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000f0002", "role": "authenticated"}';

select isnt(
  (select public.create_tenant_with_owner('Tienda Virtual', null, false, true)),
  null,
  'C2: crea tenant solo virtual');

select is(
  (select row(sells_physical, sells_virtual) from public.tenants where name = 'Tienda Virtual'),
  row(false, true),
  'C2: sells_physical=false, sells_virtual=true');

-- === C3 (ambos canales) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000f0003", "role": "authenticated"}';

select isnt(
  (select public.create_tenant_with_owner('Tienda Mixta', null, true, true)),
  null,
  'C3: crea tenant con ambos canales');

select is(
  (select row(sells_physical, sells_virtual) from public.tenants where name = 'Tienda Mixta'),
  row(true, true),
  'C3: sells_physical=true, sells_virtual=true');

-- === C4: ningun canal marcado, RPC rechaza (defensa en profundidad) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000f0004", "role": "authenticated"}';

select throws_ok(
  $$select public.create_tenant_with_owner('Tienda Fantasma', null, false, false)$$,
  'P0001', null,
  'C4: RPC rechaza si ningun canal esta marcado');

select is(
  (select count(*)::int from public.tenants where name = 'Tienda Fantasma'),
  0, 'C4: no queda tenant huerfano tras el rechazo');

-- === C7: CHECK de base bloquea un update directo dejando ambas en false ===
reset role;
select throws_ok(
  $$update public.tenants set sells_physical = false, sells_virtual = false
    where name = 'Tienda Fisica'$$,
  '23514', null,
  'C7: el CHECK de tenants rechaza un update que deja ambos canales en false');

select * from finish();
rollback;
