-- Test guardián de RLS (gobernanza ejecutable — ver docs/GOVERNANCE.md).
-- Exige: toda tabla del esquema public con RLS habilitado y al menos una política.
-- PROHIBIDO añadir exclusiones sin un ADR en docs/DECISIONS.md que lo justifique.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select is(
  (select count(*)::int from pg_tables
   where schemaname = 'public' and rowsecurity = false),
  0,
  'toda tabla de public tiene ROW LEVEL SECURITY habilitado'
);

select is(
  (select count(*)::int from pg_tables t
   where t.schemaname = 'public'
     and not exists (
       select 1 from pg_policies p
       where p.schemaname = 'public' and p.tablename = t.tablename
     )),
  0,
  'toda tabla de public tiene al menos una politica RLS'
);

select * from finish();
rollback;
