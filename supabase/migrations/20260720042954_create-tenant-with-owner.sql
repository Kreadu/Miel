-- S1-03 — Onboarding: RPC create_tenant_with_owner.
-- Ver specs/S1-03-onboarding-crear-empresa.md, docs/DECISIONS.md ADR-018 (justificacion de
-- security definer: el usuario aun no tiene membership y RLS le impediria el insert).

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

  insert into public.tenants (name, nit)
  values (trim(p_name), p_nit)
  returning id into v_tenant_id;

  insert into public.memberships (user_id, tenant_id, role, created_by)
  values (auth.uid(), v_tenant_id, 'owner', auth.uid());

  return v_tenant_id;
end;
$$;

grant execute on function public.create_tenant_with_owner(text, text) to authenticated;
