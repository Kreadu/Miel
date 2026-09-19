create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    kind text not null check (kind in ('fixed', 'variable')),
    category text not null,
    description text not null,
    amount numeric(14,2) not null check (amount > 0),
    paid_at timestamptz not null default now(),
    method text not null check (method in ('cash', 'transfer', 'card', 'other')),
    supplier_id uuid references public.suppliers(id) on delete set null,
    created_at timestamptz not null default now(),
    created_by uuid not null references auth.users(id)
);

create index expenses_tenant_id_idx on public.expenses (tenant_id);
create index expenses_supplier_id_idx on public.expenses (supplier_id);

alter table public.expenses enable row level security;

create policy "expenses_tenant_select" on public.expenses for select
  using (
    tenant_id in (select public.user_tenant_ids())
    and public.user_is_tenant_admin(tenant_id)
  );

create policy "expenses_tenant_write" on public.expenses for all
  using (
    tenant_id in (select public.user_tenant_ids())
    and public.user_is_tenant_admin(tenant_id)
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_is_tenant_admin(tenant_id)
  );

grant select, insert, update, delete on public.expenses to authenticated, service_role;

-- Trigger para updated_at (por si aplica en otras historias, aunque esta tabla sea principalmente de historial)
-- En conventions-sql.md suele requerirse el trigger set_updated_at si la tabla tiene columna updated_at.
-- Como la spec no especificó updated_at, omitimos esto para no crear una columna extra.
