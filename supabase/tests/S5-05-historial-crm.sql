begin;
select plan(8);

-- 1. Setup: Crear usuarios, tenants, membresías y dependencias
-- Tenant A con Owner A y Member A
set local role postgres;
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner_a@miel.com', '{"name": "Owner A"}'),
  ('22222222-2222-2222-2222-222222222222', 'member_a@miel.com', '{"name": "Member A"}'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@miel.com', '{"name": "Owner B"}');

insert into public.tenants (id, name) values
  ('aaaa0000-0000-0000-0000-000000000000', 'Tenant A'),
  ('bbbb0000-0000-0000-0000-000000000000', 'Tenant B');

insert into public.memberships (tenant_id, user_id, role, created_by) values
  ('aaaa0000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'member', '11111111-1111-1111-1111-111111111111'),
  ('bbbb0000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'owner', '33333333-3333-3333-3333-333333333333');

-- Crear Clientes
insert into public.customers (id, tenant_id, name, doc_type, doc_number, created_by) values
  ('1111cccc-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000000', 'Cliente Tenant A Activo', 'cc', '123', '11111111-1111-1111-1111-111111111111'),
  ('1111cccc-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000000', 'Cliente Tenant A Sin Ventas', 'cc', '124', '11111111-1111-1111-1111-111111111111'),
  ('2222cccc-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000000', 'Cliente Tenant B', 'cc', '125', '33333333-3333-3333-3333-333333333333');

-- Crear Ventas para Cliente A Activo (draft, confirmed, cancelled)
insert into public.sales (id, tenant_id, customer_id, status, subtotal, tax, total, created_by) values
  ('1111dddd-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000000', '1111cccc-0000-0000-0000-000000000001', 'confirmed', 100, 19, 119, '11111111-1111-1111-1111-111111111111'),
  ('1111dddd-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000000', '1111cccc-0000-0000-0000-000000000001', 'shipped', 200, 38, 238, '11111111-1111-1111-1111-111111111111'),
  ('1111dddd-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000000', '1111cccc-0000-0000-0000-000000000001', 'draft', 50, 0, 50, '11111111-1111-1111-1111-111111111111'),
  ('1111dddd-0000-0000-0000-000000000004', 'aaaa0000-0000-0000-0000-000000000000', '1111cccc-0000-0000-0000-000000000001', 'cancelled', 100, 0, 100, '11111111-1111-1111-1111-111111111111');

-- Crear Venta para Cliente B (Tenant B)
insert into public.sales (id, tenant_id, customer_id, status, subtotal, tax, total, created_by) values
  ('2222dddd-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000000', '2222cccc-0000-0000-0000-000000000001', 'confirmed', 500, 0, 500, '33333333-3333-3333-3333-333333333333');

-- TEST: Owner A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);

select results_eq(
  $$ select total_sales_count, total_sales_amount, average_ticket from public.customer_history where customer_id = '1111cccc-0000-0000-0000-000000000001' $$,
  $$ values (2::bigint, 357::numeric, (357.0 / 2.0)::numeric) $$,
  'Cálculo correcto: incluye confirmed/shipped y excluye draft/cancelled'
);

select results_eq(
  $$ select total_sales_count, total_sales_amount, average_ticket from public.customer_history where customer_id = '1111cccc-0000-0000-0000-000000000002' $$,
  $$ values (0::bigint, 0::numeric, 0::numeric) $$,
  'Cliente sin ventas devuelve métricas en cero de forma segura'
);

select is_empty(
  $$ select 1 from public.customer_history where customer_id = '2222cccc-0000-0000-0000-000000000001' $$,
  'Owner A no ve el cliente del Tenant B'
);

-- TEST: Member A (permisos-roles.md dice ✔ para "CRM: ver/registrar interacciones, historial de cliente")
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', true);

select results_eq(
  $$ select count(*)::int from public.customer_history $$,
  $$ values (2::int) $$,
  'Member A puede ver los historiales de todos los clientes de su tenant'
);

select results_eq(
  $$ select average_ticket from public.customer_history where customer_id = '1111cccc-0000-0000-0000-000000000001' $$,
  $$ values ((357.0 / 2.0)::numeric) $$,
  'Member A puede leer los montos del CRM sin estar bloqueado'
);

-- TEST: Owner B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}', true);

select results_eq(
  $$ select count(*)::int from public.customer_history $$,
  $$ values (1::int) $$,
  'Owner B solo ve clientes de Tenant B'
);

select results_eq(
  $$ select customer_id from public.customer_history $$,
  $$ values ('2222cccc-0000-0000-0000-000000000001'::uuid) $$,
  'Owner B ve correctamente su cliente'
);

select results_eq(
  $$ select total_sales_amount from public.customer_history where customer_id = '2222cccc-0000-0000-0000-000000000001' $$,
  $$ values (500::numeric) $$,
  'Cálculo correcto para Tenant B'
);

select * from finish();
rollback;
