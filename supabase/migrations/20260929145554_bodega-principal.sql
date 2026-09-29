-- S19-18 — Bodega o sucursal "Principal" por empresa + datos de ubicación y contacto.
-- Ver specs/S19-18-bodega-principal.md. Idempotente (SQL Editor corre cada sentencia aparte).

alter table public.warehouses
  add column if not exists is_default boolean not null default false,
  add column if not exists address text,
  add column if not exists department text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists postal_code text,
  add column if not exists phone text,
  add column if not exists whatsapp text;

-- Una sola principal por empresa.
create unique index if not exists warehouses_one_default_per_tenant
  on public.warehouses (tenant_id) where is_default;

-- La principal siempre existe: no se puede archivar.
alter table public.warehouses drop constraint if exists warehouses_default_active_check;
alter table public.warehouses
  add constraint warehouses_default_active_check check (active or not is_default);

-- is_default no es escribible desde la app: solo lo fijan esta migración y
-- create_tenant_with_owner (security definer). Grants por columna en vez de tabla completa.
revoke insert, update on public.warehouses from authenticated;
grant insert (tenant_id, name, active, address, department, city, country, postal_code, phone, whatsapp)
  on public.warehouses to authenticated;
grant update (name, active, address, department, city, country, postal_code, phone, whatsapp)
  on public.warehouses to authenticated;

-- Backfill: empresas existentes sin principal reciben una (created_by = su owner más antiguo).
insert into public.warehouses (tenant_id, name, is_default, created_by)
select t.id, 'Principal', true, o.user_id
from public.tenants t
cross join lateral (
  select m.user_id from public.memberships m
  where m.tenant_id = t.id and m.role = 'owner'
  order by m.created_at
  limit 1
) o
where not exists (
  select 1 from public.warehouses w where w.tenant_id = t.id and w.is_default
);

-- Empresas nuevas nacen con su principal. Misma firma que S19-01 (create or replace alcanza).
-- Restaura además la invariante de S14-04 (ADR-031), que la versión de S19-01 perdió al
-- reescribir la función: la empresa se funda solo en el registro, sin membership previa.
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

  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'Ya perteneces a una empresa en Miel. Las empresas se crean solo al registrarte.'
      using errcode = 'P0001';
  end if;

  insert into public.tenants (name, nit, sells_physical, sells_virtual)
  values (trim(p_name), p_nit, p_sells_physical, p_sells_virtual)
  returning id into v_tenant_id;

  insert into public.memberships (user_id, tenant_id, role, created_by)
  values (auth.uid(), v_tenant_id, 'owner', auth.uid());

  insert into public.warehouses (tenant_id, name, is_default, created_by)
  values (v_tenant_id, 'Principal', true, auth.uid());

  return v_tenant_id;
end;
$$;
