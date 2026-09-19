-- S14-04 — La empresa se funda solo en el registro inicial.
-- Ver specs/done/S14-04-empresa-solo-en-registro.md, docs/DECISIONS.md ADR-031 (supersede el
-- punto de ADR-026 que permitía al invitado fundar su propia empresa). Forward-only: reemplaza
-- create_tenant_with_owner (S1-03, ampliada por S11-01) ampliando la invariante de "ya es owner"
-- a "ya tiene cualquier membership".

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
    where user_id = auth.uid()
  ) then
    raise exception 'Ya perteneces a una empresa en Miel. Las empresas se crean solo al registrarte.'
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
