-- S21-03 — Acceso de trabajadores (ADR-037):
--  * Con correo: invitación con "Administrador" o una categoría (una sola noción de permisos).
--  * En el equipo de la tienda ("modo tienda"): el trabajador se identifica con usuario + código
--    de 4 dígitos dentro de la sesión de una cuenta de tienda; no se crean usuarios de Supabase.
-- Ver specs/done/S21-03-acceso-trabajadores.md. Idempotente.

-- 1. Categoría en membresías e invitaciones (null = sin restricción: dueño, admin y los
--    operativos que ya existían antes de las categorías).
alter table public.memberships
  add column if not exists category_id uuid references public.worker_categories(id) on delete set null;
alter table public.invitations
  add column if not exists category_id uuid references public.worker_categories(id) on delete set null,
  add column if not exists worker_id uuid references public.workers(id) on delete set null;

-- 2. Usuario y código del trabajador. El código se guarda solo como hash (bcrypt).
alter table public.workers
  add column if not exists username text,
  add column if not exists pin_hash text,
  add column if not exists user_id uuid references auth.users(id);
create unique index if not exists workers_tenant_username_key
  on public.workers (tenant_id, lower(username)) where username is not null;

-- Nadie lee el hash del código por la API (ni el dueño): select por columnas, sin pin_hash.
revoke select on public.workers from authenticated;
grant select (
  id, tenant_id, full_name, doc_type, doc_number, position_id, hire_date, worker_type, end_date,
  hourly_rate, contract_type, salary, work_schedule, eps, pension_fund, arl_risk_class, phone,
  email, address, emergency_contact_name, emergency_phone, warehouse_id, category_id, active,
  username, user_id, created_by, created_at, updated_at
) on public.workers to authenticated;
-- Usuario, hash y enlace a la cuenta solo los escriben las funciones de abajo (security definer).
revoke insert, update on public.workers from authenticated;
grant insert (
  tenant_id, full_name, doc_type, doc_number, position_id, hire_date, worker_type, end_date,
  hourly_rate, contract_type, salary, work_schedule, eps, pension_fund, arl_risk_class, phone,
  email, address, emergency_contact_name, emergency_phone, warehouse_id, category_id, active
) on public.workers to authenticated;
grant update (
  full_name, doc_type, doc_number, position_id, hire_date, worker_type, end_date,
  hourly_rate, contract_type, salary, work_schedule, eps, pension_fund, arl_risk_class, phone,
  email, address, emergency_contact_name, emergency_phone, warehouse_id, category_id, active
) on public.workers to authenticated;

-- 3. Intentos de identificación con código (bloqueo y registro de uso).
create table if not exists public.worker_login_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  worker_id uuid references public.workers(id) on delete set null,
  username text not null,
  success boolean not null,
  attempted_by uuid default auth.uid(),
  attempted_at timestamptz not null default now()
);
create index if not exists worker_login_attempts_lookup_idx
  on public.worker_login_attempts (tenant_id, lower(username), attempted_at desc);

alter table public.worker_login_attempts enable row level security;
drop policy if exists "worker_login_attempts_admin_select" on public.worker_login_attempts;
create policy "worker_login_attempts_admin_select" on public.worker_login_attempts for select
  using (public.user_is_tenant_admin(tenant_id));
grant select on public.worker_login_attempts to authenticated;
-- Sin insert/update/delete por la API: solo escribe verify_worker_pin (security definer).

-- 4. Asignar usuario + código (solo owner/admin).
create or replace function public.set_worker_pin(p_worker_id uuid, p_username text, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.workers where id = p_worker_id;
  if v_tenant_id is null or not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if lower(trim(p_username)) !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'username_invalid' using errcode = 'P0001';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'pin_invalid' using errcode = 'P0001';
  end if;
  update public.workers
  set username = lower(trim(p_username)), pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_worker_id;
end;
$$;

-- 5. Quitar el acceso con código.
create or replace function public.clear_worker_pin(p_worker_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.workers where id = p_worker_id;
  if v_tenant_id is null or not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  update public.workers set username = null, pin_hash = null where id = p_worker_id;
end;
$$;

-- 6. Identificar al trabajador en el equipo de la tienda. Cualquiera con sesión en la empresa
--    (la cuenta de tienda) puede intentarlo; 5 fallos en 15 minutos bloquean ese usuario.
--    Devuelve el trabajador y los módulos de su categoría, o ninguna fila si el usuario o el
--    código no coinciden (no revela cuál de los dos falló).
create or replace function public.verify_worker_pin(p_tenant_id uuid, p_username text, p_pin text)
returns table (worker_id uuid, full_name text, modules text[])
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text := lower(trim(p_username));
  v_worker public.workers%rowtype;
  v_ok boolean;
begin
  if p_tenant_id is null or p_tenant_id not in (select public.user_tenant_ids()) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.worker_login_attempts a
    where a.tenant_id = p_tenant_id and lower(a.username) = v_username
      and not a.success and a.attempted_at > now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'locked' using errcode = 'P0001';
  end if;

  select * into v_worker from public.workers w
  where w.tenant_id = p_tenant_id and lower(w.username) = v_username and w.active and w.pin_hash is not null;
  v_ok := found and v_worker.pin_hash = crypt(coalesce(p_pin, ''), v_worker.pin_hash);

  insert into public.worker_login_attempts (tenant_id, worker_id, username, success)
  values (p_tenant_id, case when v_ok then v_worker.id end, v_username, v_ok);

  -- Código incorrecto: sin filas (no una excepción, que desharía el registro del intento y el
  -- bloqueo nunca se activaría).
  if not v_ok then
    return;
  end if;

  return query
  select v_worker.id, v_worker.full_name, coalesce(c.modules, '{}'::text[])
  from (select 1) x
  left join public.worker_categories c on c.id = v_worker.category_id;
end;
$$;

revoke all on function public.set_worker_pin(uuid, text, text) from public, anon;
revoke all on function public.clear_worker_pin(uuid) from public, anon;
revoke all on function public.verify_worker_pin(uuid, text, text) from public, anon;
grant execute on function public.set_worker_pin(uuid, text, text) to authenticated;
grant execute on function public.clear_worker_pin(uuid) to authenticated;
grant execute on function public.verify_worker_pin(uuid, text, text) to authenticated;

-- 7. Módulos del trabajador identificado, leídos en cada request (la cookie de la tienda solo
--    guarda qué trabajador está; los permisos se releen aquí, así un cambio de categoría o un
--    retiro aplica al instante).
create or replace function public.active_worker_modules(p_tenant_id uuid, p_worker_id uuid)
returns table (full_name text, modules text[])
language sql
stable
security definer
set search_path = public
as $$
  select w.full_name, coalesce(c.modules, '{}'::text[])
  from public.workers w
  left join public.worker_categories c on c.id = w.category_id
  where w.id = p_worker_id and w.tenant_id = p_tenant_id and w.active and w.pin_hash is not null
    and p_tenant_id in (select public.user_tenant_ids());
$$;
revoke all on function public.active_worker_modules(uuid, uuid) from public, anon;
grant execute on function public.active_worker_modules(uuid, uuid) to authenticated;

-- 8. Invitación con categoría: al aceptarla la membresía nace con esa categoría y, si vino desde
--    la ficha de un trabajador, queda enlazada a él (y su categoría lo sigue, trigger abajo).
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

  insert into public.memberships (user_id, tenant_id, role, category_id, created_by)
  values (auth.uid(), v_invitation.tenant_id, v_invitation.role, v_invitation.category_id, auth.uid());

  if v_invitation.worker_id is not null then
    update public.workers set user_id = auth.uid()
    where id = v_invitation.worker_id and tenant_id = v_invitation.tenant_id and user_id is null;
  end if;

  update public.invitations set accepted_at = now() where id = v_invitation.id;

  return v_invitation.tenant_id;
end;
$$;
grant execute on function public.accept_invitation(uuid) to authenticated;

create or replace function public.sync_worker_membership_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and new.category_id is distinct from old.category_id then
    update public.memberships set category_id = new.category_id
    where user_id = new.user_id and tenant_id = new.tenant_id and role = 'member';
  end if;
  return new;
end;
$$;

drop trigger if exists workers_sync_membership_category on public.workers;
create trigger workers_sync_membership_category
  after update of category_id on public.workers
  for each row execute function public.sync_worker_membership_category();
