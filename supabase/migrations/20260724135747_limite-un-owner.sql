-- S11-01 — Límite de una empresa como owner por usuario.
-- Ver specs/S11-01-limite-un-owner.md, docs/DECISIONS.md ADR-026 (multiempresa solo vía
-- invitación). Forward-only: reemplaza create_tenant_with_owner (S1-03) añadiendo la invariante.

create or replace function public.create_tenant_with_owner(
  p_name text, p_nit text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para crear una empresa' using errcode = 'P0001';
  end if;

  if trim(p_name) = '' then
    raise exception 'El nombre de la empresa es obligatorio' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.memberships
    where user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Ya eres owner de una empresa. Las empresas adicionales se unen por invitación.'
      using errcode = 'P0001';
  end if;

  insert into public.tenants (name, nit)
  values (trim(p_name), p_nit)
  returning id into v_tenant_id;

  insert into public.memberships (user_id, tenant_id, role, created_by)
  values (auth.uid(), v_tenant_id, 'owner', auth.uid());

  return v_tenant_id;
end;
$$;
