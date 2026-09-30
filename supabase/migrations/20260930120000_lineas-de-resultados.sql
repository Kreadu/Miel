-- S22-02 — Estado de resultados: cada categoría de gasto dice en qué línea cae (operativo,
-- depreciación, financiero o impuesto de renta). Ver specs/S22-02-estado-de-resultados.md.
-- Idempotente.

alter table public.expense_categories
  add column if not exists pnl_line text not null default 'operativo';
alter table public.expense_categories drop constraint if exists expense_categories_pnl_line_check;
alter table public.expense_categories add constraint expense_categories_pnl_line_check
  check (pnl_line in ('operativo', 'depreciacion', 'financiero', 'impuesto_renta'));

-- Lista inicial con su línea (reemplaza la de S22-01; las existentes no se duplican).
create or replace function public.seed_expense_categories(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.expense_categories (tenant_id, name, kind, pnl_line, is_default, created_by)
  select p_tenant_id, c.name, c.kind, c.line, true, null
  from (values
    ('Arriendo', 'fixed', 'operativo'),
    ('Servicios públicos (agua, luz, gas)', 'fixed', 'operativo'),
    ('Internet y telefonía', 'fixed', 'operativo'),
    ('Artículos de oficina y papelería', 'fixed', 'operativo'),
    ('Aseo y limpieza', 'fixed', 'operativo'),
    ('Mobiliario y equipos (mantenimiento)', 'fixed', 'operativo'),
    ('Herramientas y maquinaria (mantenimiento)', 'fixed', 'operativo'),
    ('Seguros', 'fixed', 'operativo'),
    ('Contabilidad y asesorías', 'fixed', 'operativo'),
    ('Software y suscripciones', 'fixed', 'operativo'),
    ('Impuestos y licencias', 'fixed', 'operativo'),
    ('Vigilancia y seguridad', 'fixed', 'operativo'),
    ('Cuotas de crédito o leasing', 'fixed', 'financiero'),
    ('Depreciación y amortización', 'fixed', 'depreciacion'),
    ('Intereses y gastos financieros', 'fixed', 'financiero'),
    ('Impuesto de renta', 'fixed', 'impuesto_renta'),
    ('Transporte y envíos', 'variable', 'operativo'),
    ('Combustible', 'variable', 'operativo'),
    ('Mantenimiento de vehículos', 'variable', 'operativo'),
    ('Publicidad y marketing', 'variable', 'operativo'),
    ('Comisiones de venta', 'variable', 'operativo'),
    ('Empaques y bolsas', 'variable', 'operativo'),
    ('Comisiones bancarias y datáfono', 'variable', 'financiero'),
    ('Viáticos y alimentación', 'variable', 'operativo'),
    ('Reparaciones imprevistas', 'variable', 'operativo')
  ) as c(name, kind, line)
  on conflict (tenant_id, name) do nothing;
$$;
revoke all on function public.seed_expense_categories(uuid) from public, anon, authenticated;

select public.seed_expense_categories(id) from public.tenants;

update public.expense_categories set pnl_line = 'financiero'
where is_default and name in ('Cuotas de crédito o leasing', 'Comisiones bancarias y datáfono');
