-- S5-07 — Interacciones postventa CRM: tabla append-only, escritura abierta a todo el tenant.
-- Ver specs/S5-07-interacciones-crm.md.

create table public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid not null references public.customers(id),
  kind text not null check (kind in ('note', 'followup', 'complaint', 'promo')),
  note text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_interactions_tenant_id_idx on public.customer_interactions (tenant_id);
create index customer_interactions_customer_id_idx on public.customer_interactions (customer_id);

create trigger customer_interactions_set_updated_at
  before update on public.customer_interactions
  for each row execute function public.set_updated_at();

alter table public.customer_interactions enable row level security;

-- Todo el tenant ve las interacciones (matriz de permisos: owner/admin/member = ✔).
create policy "customer_interactions_tenant_select" on public.customer_interactions
  for select
  using (tenant_id in (select public.user_tenant_ids()));

-- Todo el tenant registra interacciones (diferencia deliberada frente a customers: no
-- restringido a admin, igual que customer_payments).
create policy "customer_interactions_tenant_insert" on public.customer_interactions
  for insert
  with check (tenant_id in (select public.user_tenant_ids()));

-- Sin políticas de update/delete: append-only real, no solo por convención de UI.

grant select, insert on public.customer_interactions to authenticated, service_role;
