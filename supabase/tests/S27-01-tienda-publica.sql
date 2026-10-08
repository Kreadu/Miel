-- S27-01 — Tienda pública: ajustes de la tienda en tenants (solo admin, reglas como CHECK) y las
-- dos funciones públicas store_info/store_catalog (únicas puertas para anon).
-- Ver specs/S27-01-tienda-publica-catalogo.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000027101', 'owner-s2701@test.local'),
  ('00000000-0000-0000-0000-000000027102', 'member-s2701@test.local'),
  ('00000000-0000-0000-0000-000000027103', 'owner-b-s2701@test.local');

insert into public.tenants (id, name, phone) values
  ('10000000-0000-0000-0000-000000027101', 'Dulce Miel', '3001234567'),
  ('10000000-0000-0000-0000-000000027102', 'Otra', null);

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000027101', '10000000-0000-0000-0000-000000027101', 'owner',
   '00000000-0000-0000-0000-000000027101'),
  ('00000000-0000-0000-0000-000000027102', '10000000-0000-0000-0000-000000027101', 'member',
   '00000000-0000-0000-0000-000000027101'),
  ('00000000-0000-0000-0000-000000027103', '10000000-0000-0000-0000-000000027102', 'owner',
   '00000000-0000-0000-0000-000000027103');

insert into public.product_categories (id, tenant_id, name, created_by) values
  ('70000000-0000-0000-0000-000000027101', '10000000-0000-0000-0000-000000027101', 'Mieles',
   '00000000-0000-0000-0000-000000027101');

-- P1 vendible con stock · P2 vendible agotado · P3 solo tienda física · P4 insumo
-- P5 archivado · P6 sin precio · P7 de la otra empresa
insert into public.products (id, tenant_id, sku, name, description, cost, price, tax_rate,
                             discount_percent, inventory, sales_channel, active, category_id, created_by) values
  ('30000000-0000-0000-0000-000000027101', '10000000-0000-0000-0000-000000027101', 'P1', 'Miel 500g',
   'Pura', 8000, 10000, 19, 10, 'productos', 'both', true, '70000000-0000-0000-0000-000000027101',
   '00000000-0000-0000-0000-000000027101'),
  ('30000000-0000-0000-0000-000000027102', '10000000-0000-0000-0000-000000027101', 'P2', 'Polen',
   null, 5000, 7000, 0, 0, 'productos', 'online', true, null, '00000000-0000-0000-0000-000000027101'),
  ('30000000-0000-0000-0000-000000027103', '10000000-0000-0000-0000-000000027101', 'P3', 'Solo local',
   null, 1, 2, 0, 0, 'productos', 'in_store', true, null, '00000000-0000-0000-0000-000000027101'),
  ('30000000-0000-0000-0000-000000027104', '10000000-0000-0000-0000-000000027101', 'P4', 'Frasco',
   null, 1, 2, 0, 0, 'materias_primas', 'both', true, null, '00000000-0000-0000-0000-000000027101'),
  ('30000000-0000-0000-0000-000000027105', '10000000-0000-0000-0000-000000027101', 'P5', 'Viejo',
   null, 1, 2, 0, 0, 'productos', 'both', false, null, '00000000-0000-0000-0000-000000027101'),
  ('30000000-0000-0000-0000-000000027106', '10000000-0000-0000-0000-000000027101', 'P6', 'Sin precio',
   null, 1, 0, 0, 0, 'productos', 'both', true, null, '00000000-0000-0000-0000-000000027101'),
  ('30000000-0000-0000-0000-000000027107', '10000000-0000-0000-0000-000000027102', 'P7', 'Ajeno',
   null, 1, 2, 0, 0, 'productos', 'both', true, null, '00000000-0000-0000-0000-000000027103');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000027101', '10000000-0000-0000-0000-000000027101', 'B1',
   '00000000-0000-0000-0000-000000027101'),
  ('40000000-0000-0000-0000-000000027102', '10000000-0000-0000-0000-000000027101', 'B2',
   '00000000-0000-0000-0000-000000027101');

-- P1: 3 en B1 + 2 en B2 = 5 (disponible). P2: entró 2 y salió 2 = 0 (agotado).
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000027101', '30000000-0000-0000-0000-000000027101', '40000000-0000-0000-0000-000000027101', 'in', 3, 8000, '00000000-0000-0000-0000-000000027101'),
  ('10000000-0000-0000-0000-000000027101', '30000000-0000-0000-0000-000000027101', '40000000-0000-0000-0000-000000027102', 'in', 2, 8000, '00000000-0000-0000-0000-000000027101'),
  ('10000000-0000-0000-0000-000000027101', '30000000-0000-0000-0000-000000027102', '40000000-0000-0000-0000-000000027101', 'in', 2, 5000, '00000000-0000-0000-0000-000000027101'),
  ('10000000-0000-0000-0000-000000027101', '30000000-0000-0000-0000-000000027102', '40000000-0000-0000-0000-000000027101', 'out', -2, 5000, '00000000-0000-0000-0000-000000027101');

-- === C1: el operativo no cambia la tienda (RLS de tenants: no actualiza nada) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000027102", "role": "authenticated"}';
update public.tenants set store_enabled = true, store_slug = 'intrusa'
  where id = '10000000-0000-0000-0000-000000027101';
reset role;
select is((select store_slug from public.tenants where id = '10000000-0000-0000-0000-000000027101'),
  null, 'C1: un operativo no cambia la tienda');

-- === C1: reglas de la BD ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000027101", "role": "authenticated"}';
select throws_ok(
  $$update public.tenants set store_enabled = true where id = '10000000-0000-0000-0000-000000027101'$$,
  '23514', null, 'C1: activar exige dirección');
select throws_ok(
  $$update public.tenants set store_slug = 'Dulce Miel!' where id = '10000000-0000-0000-0000-000000027101'$$,
  '23514', null, 'C1: formato de dirección inválido');
select throws_ok(
  $$update public.tenants set store_slug = 'admin' where id = '10000000-0000-0000-0000-000000027101'$$,
  '23514', null, 'C1: dirección reservada');
select throws_ok(
  $$update public.tenants set store_slug = '-ab' where id = '10000000-0000-0000-0000-000000027101'$$,
  '23514', null, 'C1: no empieza con guion');
select throws_ok(
  $$update public.tenants set store_color = 'red; x' where id = '10000000-0000-0000-0000-000000027101'$$,
  '23514', null, 'C1: color inválido');
select lives_ok(
  $$update public.tenants set store_enabled = true, store_slug = 'dulce-miel', store_color = '#A0522D'
    where id = '10000000-0000-0000-0000-000000027101'$$,
  'C1: el dueño activa su tienda');

-- La otra empresa no puede tomar la misma dirección.
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000027103", "role": "authenticated"}';
select throws_ok(
  $$update public.tenants set store_slug = 'dulce-miel' where id = '10000000-0000-0000-0000-000000027102'$$,
  '23505', null, 'C1: dirección tomada');
select throws_ok(
  $$update public.tenants set store_slug = 'DULCE-MIEL' where id = '10000000-0000-0000-0000-000000027102'$$,
  '23514', null, 'C1: mayúsculas no (la app normaliza antes)');
update public.tenants set store_slug = 'otra' where id = '10000000-0000-0000-0000-000000027102';

-- === C2/C3: como visitante anónimo ===
reset role;
set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';

select is((select count(*)::int from public.store_catalog('dulce-miel')), 3,
  'C2: P1, P2 y P3 (S27-08: también los de tienda física, como publicidad)');
select is((select available from public.store_catalog('dulce-miel') where name = 'Miel 500g'), true,
  'C2: con stock en dos bodegas = disponible');
select is((select available from public.store_catalog('dulce-miel') where name = 'Polen'), false,
  'C2: suma 0 = agotado');
select is((select category from public.store_catalog('dulce-miel') where name = 'Miel 500g'), 'Mieles',
  'C2: trae el nombre de la categoría');
select is((select price from public.store_catalog('dulce-miel') where name = 'Miel 500g'), 10000::numeric,
  'C2: precio base (el final lo calcula la app con descuento e IVA)');
select is((select discount_percent from public.store_catalog('dulce-miel') where name = 'Miel 500g'), 10::numeric,
  'C2: trae el descuento');
select is((select name from public.store_info('dulce-miel')), 'Dulce Miel', 'C2: store_info trae el nombre');
select is((select store_color from public.store_info('dulce-miel')), '#A0522D', 'C2: y el color');
select is((select count(*)::int from public.store_catalog('otra')), 0,
  'C3: tienda apagada (la otra no activó) no muestra productos');
select is((select count(*)::int from public.store_info('otra')), 0, 'C3: ni sus datos');
select is((select count(*)::int from public.store_catalog('no-existe')), 0, 'C3: dirección inexistente');
select is((select count(*)::int from public.store_catalog('../x')), 0, 'C3: formato inválido no consulta');
select is((select count(*)::int from public.products), 0, 'C3: anon no lee products');
select is((select count(*)::int from public.tenants), 0, 'C3: anon no lee tenants');
select is((select count(*)::int from public.stock_movements), 0, 'C3: anon no lee stock_movements');

-- La tienda apagada deja de responder aunque conserve su dirección.
reset role;
update public.tenants set store_enabled = false where id = '10000000-0000-0000-0000-000000027101';
set local role anon;
select is((select count(*)::int from public.store_catalog('dulce-miel')), 0, 'C3: al apagarla deja de responder');

select * from finish();
rollback;
