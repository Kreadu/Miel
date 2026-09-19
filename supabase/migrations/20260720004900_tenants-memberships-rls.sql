-- S1-01 — Esquema base multitenant: tenants, memberships, RLS.
-- Ver specs/S1-01-tenants-auth.md, docs/arch/multitenancy-rls.md, docs/arch/convenciones-sql.md.

-- === Trigger compartido de updated_at (convenciones-sql.md) — reuso futuro ===
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- === tenants ===
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nit text,
  currency text not null default 'COP',
  created_at timestamptz not null default now()
);

-- === memberships ===
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null check (role in ('owner', 'admin', 'member')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_tenant_id_idx on public.memberships (tenant_id);

-- === Helpers security definer (patrón de multitenancy-rls.md) ===

-- Tenants a los que pertenece el usuario autenticado.
create or replace function public.user_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships where user_id = auth.uid()
$$;

-- Evita recursión de RLS al comprobar rol owner/admin dentro de políticas de memberships/tenants.
create or replace function public.user_is_tenant_admin(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

-- === RLS: tenants ===
alter table public.tenants enable row level security;

create policy "tenants_member_select" on public.tenants for select
  using (id in (select public.user_tenant_ids()));

create policy "tenants_admin_update" on public.tenants for update
  using (public.user_is_tenant_admin(id))
  with check (public.user_is_tenant_admin(id));

-- Sin política de insert: el primer owner nace vía RPC security definer (S1-03).
-- Sin política de delete: eliminar un tenant es operación de plataforma (ADR-019).

-- === RLS: memberships ===
alter table public.memberships enable row level security;

create policy "memberships_tenant_select" on public.memberships for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "memberships_admin_write" on public.memberships for all
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

-- === Grants de tabla (RLS filtra filas; el GRANT habilita la operación) ===
grant select, update on public.tenants to authenticated, service_role;
grant select, insert, update, delete on public.memberships to authenticated, service_role;
