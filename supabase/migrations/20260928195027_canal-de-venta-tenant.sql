-- S19-01 — Canal de venta del tenant: física y/o virtual, combinables.
-- Ver specs/S19-01-canal-de-venta-fisica-virtual.md, ADR-034.

alter table public.tenants
  add column sells_physical boolean not null default true,
  add column sells_virtual boolean not null default false,
  add constraint tenants_sells_channel_check check (sells_physical or sells_virtual);

-- CREATE OR REPLACE no reemplaza una funcion si cambia su lista de argumentos (crea un
-- overload nuevo y deja el viejo huerfano, sin el invariante de canal) — hay que dropearla
-- primero para que quede una sola version con la firma extendida.
drop function if exists public.create_tenant_with_owner(text, text);

create or replace function public.create_tenant_with_owner(
  p_name text,
  p_nit text default null,
  p_sells_physical boolean default true,
  p_sells_virtual boolean default false
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

  if not (p_sells_physical or p_sells_virtual) then
    raise exception 'Elige al menos un canal de venta: local fisico o catalogo online'
      using errcode = 'P0001';
  end if;

  insert into public.tenants (name, nit, sells_physical, sells_virtual)
  values (trim(p_name), p_nit, p_sells_physical, p_sells_virtual)
  returning id into v_tenant_id;

  insert into public.memberships (user_id, tenant_id, role, created_by)
  values (auth.uid(), v_tenant_id, 'owner', auth.uid());

  return v_tenant_id;
end;
$$;

grant execute on function public.create_tenant_with_owner(text, text, boolean, boolean)
  to authenticated;
