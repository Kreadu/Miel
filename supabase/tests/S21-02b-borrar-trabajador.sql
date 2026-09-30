-- S21-02b — Borrar trabajador: owner sí, member no, otra empresa no.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000021ba01', 'owner-a-s2102b@test.local'),
  ('00000000-0000-0000-0000-00000021ba02', 'member-a-s2102b@test.local'),
  ('00000000-0000-0000-0000-00000021bb01', 'owner-b-s2102b@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000021ba01', 'Tenant A S21-02b'),
  ('10000000-0000-0000-0000-00000021bb01', 'Tenant B S21-02b');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000021ba01', '10000000-0000-0000-0000-00000021ba01', 'owner',
   '00000000-0000-0000-0000-00000021ba01'),
  ('00000000-0000-0000-0000-00000021ba02', '10000000-0000-0000-0000-00000021ba01', 'member',
   '00000000-0000-0000-0000-00000021ba01'),
  ('00000000-0000-0000-0000-00000021bb01', '10000000-0000-0000-0000-00000021bb01', 'owner',
   '00000000-0000-0000-0000-00000021bb01');
insert into public.workers (id, tenant_id, full_name, doc_number, created_by) values
  ('40000000-0000-0000-0000-00000021ba01', '10000000-0000-0000-0000-00000021ba01', 'Ana', '1',
   '00000000-0000-0000-0000-00000021ba01'),
  ('40000000-0000-0000-0000-00000021ba02', '10000000-0000-0000-0000-00000021ba01', 'Luis', '2',
   '00000000-0000-0000-0000-00000021ba01');

set local role authenticated;

-- member no borra (0 filas, sin error por RLS)
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000021ba02", "role": "authenticated"}';
delete from public.workers where id = '40000000-0000-0000-0000-00000021ba01';

-- otra empresa no borra
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000021bb01", "role": "authenticated"}';
delete from public.workers where id = '40000000-0000-0000-0000-00000021ba01';

-- owner sí
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000021ba01", "role": "authenticated"}';
delete from public.workers where id = '40000000-0000-0000-0000-00000021ba02';

reset role;
select ok(exists (select 1 from public.workers where id = '40000000-0000-0000-0000-00000021ba01'),
  'member y otra empresa no pudieron borrar a Ana');
select ok(not exists (select 1 from public.workers where id = '40000000-0000-0000-0000-00000021ba02'),
  'owner borró a Luis');
select is((select count(*)::int from public.workers where tenant_id = '10000000-0000-0000-0000-00000021ba01'),
  1, 'queda solo Ana');

select * from finish();
rollback;
