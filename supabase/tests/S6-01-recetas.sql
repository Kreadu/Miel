begin;
select plan(10);

-- Usuarios
insert into auth.users (id, email) values 
  ('11111111-1111-1111-1111-111111111111', 'admin1@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'member1@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin2@test.com');

-- 1. Setup
-- Tenant 1
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-000000000001', 'Tenant 1');
-- Tenant 2
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-000000000002', 'Tenant 2');

-- Memberships
insert into public.memberships (user_id, tenant_id, role, created_by) values 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'admin', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'member', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'admin', '33333333-3333-3333-3333-333333333333');

-- Productos T1
insert into public.products (id, tenant_id, sku, name, kind, created_by) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'RAW1', 'Insumo 1', 'raw', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'RAW2', 'Insumo 2', 'raw', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'FIN1', 'Terminado 1', 'finished', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'RES1', 'Reventa 1', 'resale', '11111111-1111-1111-1111-111111111111');

-- Productos T2
insert into public.products (id, tenant_id, sku, name, kind, created_by) values 
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000002', 'RAW3', 'Insumo 3', 'raw', '33333333-3333-3333-3333-333333333333');

-- 2. Tests
-- Set auth context a admin T1
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111", "role":"authenticated"}';

-- Guardar receta válida
select lives_ok(
  $$ select save_recipe('cccccccc-cccc-cccc-cccc-cccccccccccc', '[{"component_product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 1.5}, {"component_product_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "qty": 0.5}]'::jsonb) $$,
  'Admin T1 guarda receta válida para producto finished'
);

select results_eq(
  $$ select component_product_id, qty from recipe_items order by component_product_id $$,
  $$ values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 1.5), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 0.5) $$,
  'Receta guardada con las cantidades correctas'
);

-- Reemplazo de receta
select lives_ok(
  $$ select save_recipe('cccccccc-cccc-cccc-cccc-cccccccccccc', '[{"component_product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 2.0}]'::jsonb) $$,
  'Admin T1 reemplaza receta válida'
);

select results_eq(
  $$ select component_product_id, qty from recipe_items order by component_product_id $$,
  $$ values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 2.0) $$,
  'Receta reemplazada correctamente, componentes viejos borrados'
);

-- Producto no finished
select throws_ok(
  $$ select save_recipe('dddddddd-dddd-dddd-dddd-dddddddddddd', '[{"component_product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 1.0}]'::jsonb) $$,
  'P0001', 'product_not_finished',
  'Falla al guardar receta para producto no finished'
);

-- Insumo de otro tenant
select throws_ok(
  $$ select save_recipe('cccccccc-cccc-cccc-cccc-cccccccccccc', '[{"component_product_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "qty": 1.0}]'::jsonb) $$,
  'P0001', 'component_tenant_mismatch',
  'Falla al usar insumo de otro tenant (no lo encuentra)'
);

-- Cantidad <= 0
select throws_ok(
  $$ select save_recipe('cccccccc-cccc-cccc-cccc-cccccccccccc', '[{"component_product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 0}]'::jsonb) $$,
  'P0001', 'recipe_qty_invalid',
  'Falla con qty 0'
);

-- 3. Tests de permisos
-- Set auth context a member T1
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222", "role":"authenticated"}';

select throws_ok(
  $$ select save_recipe('cccccccc-cccc-cccc-cccc-cccccccccccc', '[{"component_product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 1.0}]'::jsonb) $$,
  'P0001', 'permission_denied',
  'Member no puede guardar receta'
);

select throws_ok(
  $$ insert into public.recipe_items (tenant_id, product_id, component_product_id, qty) values ('00000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1.0) $$,
  '42501',
  NULL,
  'Member no puede insertar directo por RLS'
);

-- Admin T2 intenta modificar receta de T1
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333", "role":"authenticated"}';

select throws_ok(
  $$ select save_recipe('cccccccc-cccc-cccc-cccc-cccccccccccc', '[{"component_product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 1.0}]'::jsonb) $$,
  'P0001', 'permission_denied',
  'Admin T2 no puede ver/modificar producto de T1'
);

select * from finish();
rollback;
