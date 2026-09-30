-- S22-01 — Gastos fijos y variables con categorías ya clasificadas: quien anota el gasto solo
-- elige la categoría y el tipo (fijo/variable) lo pone la base de datos. Ver
-- specs/done/S22-01-gastos-fijos-y-variables.md. Idempotente.

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('fixed', 'variable')),
  is_default boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create index if not exists expense_categories_tenant_id_idx on public.expense_categories (tenant_id);

alter table public.expense_categories enable row level security;
-- Mismo criterio que expenses: solo owner/admin.
drop policy if exists "expense_categories_admin_all" on public.expense_categories;
create policy "expense_categories_admin_all" on public.expense_categories for all
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));
grant select, insert, update, delete on public.expense_categories to authenticated, service_role;

-- Lista inicial (incluye las de los inventarios que no se venden: oficina, aseo, mobiliario,
-- herramientas, vehículos). Las materias primas y la mercancía no son gasto: son costo.
create or replace function public.seed_expense_categories(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.expense_categories (tenant_id, name, kind, is_default, created_by)
  select p_tenant_id, c.name, c.kind, true, null
  from (values
    ('Arriendo', 'fixed'),
    ('Servicios públicos (agua, luz, gas)', 'fixed'),
    ('Internet y telefonía', 'fixed'),
    ('Artículos de oficina y papelería', 'fixed'),
    ('Aseo y limpieza', 'fixed'),
    ('Mobiliario y equipos (mantenimiento)', 'fixed'),
    ('Herramientas y maquinaria (mantenimiento)', 'fixed'),
    ('Seguros', 'fixed'),
    ('Contabilidad y asesorías', 'fixed'),
    ('Software y suscripciones', 'fixed'),
    ('Impuestos y licencias', 'fixed'),
    ('Vigilancia y seguridad', 'fixed'),
    ('Cuotas de crédito o leasing', 'fixed'),
    ('Transporte y envíos', 'variable'),
    ('Combustible', 'variable'),
    ('Mantenimiento de vehículos', 'variable'),
    ('Publicidad y marketing', 'variable'),
    ('Comisiones de venta', 'variable'),
    ('Empaques y bolsas', 'variable'),
    ('Comisiones bancarias y datáfono', 'variable'),
    ('Viáticos y alimentación', 'variable'),
    ('Reparaciones imprevistas', 'variable')
  ) as c(name, kind)
  on conflict (tenant_id, name) do nothing;
$$;
revoke all on function public.seed_expense_categories(uuid) from public, anon, authenticated;

-- Empresas existentes y nuevas.
select public.seed_expense_categories(id) from public.tenants;

create or replace function public.seed_expense_categories_on_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_expense_categories(new.id);
  return new;
end;
$$;
drop trigger if exists tenants_seed_expense_categories on public.tenants;
create trigger tenants_seed_expense_categories
  after insert on public.tenants
  for each row execute function public.seed_expense_categories_on_tenant();

-- El tipo del gasto lo manda su categoría (fiable aunque quien anota se equivoque). Una
-- categoría que no esté en la lista (gastos viejos escritos a mano) conserva el tipo elegido.
create or replace function public.expense_kind_from_category()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.expense_categories
  where tenant_id = new.tenant_id and name = new.category;
  if v_kind is not null then
    new.kind := v_kind;
  end if;
  return new;
end;
$$;
drop trigger if exists expenses_kind_from_category on public.expenses;
create trigger expenses_kind_from_category
  before insert or update of category, kind on public.expenses
  for each row execute function public.expense_kind_from_category();
