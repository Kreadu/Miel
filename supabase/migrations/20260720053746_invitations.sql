-- S1-05 — Invitaciones con rol: tabla invitations + RLS (solo owner/admin del tenant) y
-- RPC accept_invitation. Ver specs/S1-05-invitaciones-roles.md,
-- docs/arch/multitenancy-rls.md, docs/DECISIONS.md ADR-018.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token uuid unique not null default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index invitations_tenant_id_idx on public.invitations (tenant_id);

alter table public.invitations enable row level security;

-- Solo owner/admin del tenant gestionan invitaciones (permisos-roles.md: "Invitar usuarios").
-- El invitado no lee esta tabla — resuelve todo por accept_invitation, sin política pública.
create policy "invitations_admin_all" on public.invitations for all
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert, update, delete on public.invitations to authenticated, service_role;

-- security definer (ADR-018): el invitado aun no tiene membership en el tenant, RLS le
-- impediria leer la invitacion y crear su propia membership.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para aceptar una invitacion' using errcode = 'P0001';
  end if;

  select * into v_invitation
  from public.invitations
  where token = p_token
  for update;

  if v_invitation is null or v_invitation.accepted_at is not null
     or v_invitation.expires_at <= now() then
    raise exception 'Esta invitacion no es valida o ya fue usada' using errcode = 'P0001';
  end if;

  v_user_email := auth.jwt() ->> 'email';
  if v_user_email is null or lower(v_user_email) <> lower(v_invitation.email) then
    raise exception 'Esta invitacion no es valida o ya fue usada' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.memberships
    where user_id = auth.uid() and tenant_id = v_invitation.tenant_id
  ) then
    raise exception 'Ya eres miembro de esta empresa' using errcode = 'P0001';
  end if;

  insert into public.memberships (user_id, tenant_id, role, created_by)
  values (auth.uid(), v_invitation.tenant_id, v_invitation.role, auth.uid());

  update public.invitations set accepted_at = now() where id = v_invitation.id;

  return v_invitation.tenant_id;
end;
$$;

grant execute on function public.accept_invitation(uuid) to authenticated;
