-- Pegar completo en Supabase → SQL Editor del proyecto (cloud) y ejecutar UNA vez.
-- S26-08 (el nombre que firma las órdenes sale de RRHH). Borrar este archivo después de aplicarlo.
begin;
-- S26-08 — El nombre que firma las órdenes sale de RRHH → Trabajadores. memberships.display_name
-- pasa a ser copia automática del trabajador conectado (por invitación o por el mismo correo) y se
-- elimina "Mi perfil" (set_my_display_name). Ver specs/S26-08-nombre-desde-rrhh.md.

-- 1. Conectar por correo y copiar el nombre a la membresía (una sola fuente: RRHH).
create or replace function public.sync_worker_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin cuenta conectada: la de esa empresa con el mismo correo, si aún no tiene trabajador.
  if new.user_id is null and nullif(btrim(new.email), '') is not null then
    select u.id into new.user_id
    from auth.users u
    join public.memberships m on m.user_id = u.id and m.tenant_id = new.tenant_id
    where lower(u.email) = lower(btrim(new.email))
      and not exists (
        select 1 from public.workers w
        where w.tenant_id = new.tenant_id and w.user_id = u.id and w.id <> new.id
      )
    limit 1;
  end if;

  if new.user_id is not null then
    update public.memberships set display_name = new.full_name
    where user_id = new.user_id and tenant_id = new.tenant_id
      and display_name is distinct from new.full_name;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_worker_account() from public, anon, authenticated;

drop trigger if exists workers_sync_account on public.workers;
create trigger workers_sync_account
  before insert or update of full_name, email, user_id on public.workers
  for each row execute function public.sync_worker_account();

-- 2. Datos existentes: los nombres de "Mi perfil" se descartan; queda el de RRHH.
update public.memberships set display_name = null;
update public.workers set email = email where nullif(btrim(email), '') is not null or user_id is not null;

-- 3. Firma: el trabajador activo conectado a la cuenta en esa empresa.
create or replace function public.my_display_name(p_tenant_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select nullif(btrim(full_name), '') into v_name
  from public.workers
  where tenant_id = p_tenant_id and user_id = auth.uid() and active
  limit 1;
  if v_name is null then
    raise exception 'display_name_required' using errcode = 'P0001';
  end if;
  return v_name;
end;
$$;
revoke all on function public.my_display_name(uuid) from public, anon, authenticated;

-- 4. Fuera "Mi perfil".
drop function if exists public.set_my_display_name(uuid, text);
commit;
