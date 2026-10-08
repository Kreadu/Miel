-- S26-12 — Conectar mi ficha de RRHH con mi cuenta: si quien invita escribe su propio correo en
-- "Acceso con correo", la app llama a esta RPC en vez de invitar. Ver specs/S26-12-conectar-mi-ficha.md.
create or replace function public.link_worker_to_me(p_worker_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker record;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_worker from public.workers where id = p_worker_id for update;
  if v_worker.id is null or not public.user_is_tenant_admin(v_worker.tenant_id) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
  if v_worker.user_id is not null and v_worker.user_id <> auth.uid() then
    raise exception 'worker_linked' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.workers
    where tenant_id = v_worker.tenant_id and user_id = auth.uid() and id <> p_worker_id
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  -- El trigger workers_sync_account (S26-08) copia el nombre a la membresía.
  update public.workers
  set user_id = auth.uid(), email = coalesce(nullif(btrim(email), ''), v_email)
  where id = p_worker_id;

  delete from public.invitations
  where tenant_id = v_worker.tenant_id and lower(email) = lower(v_email) and accepted_at is null;
end;
$$;
revoke all on function public.link_worker_to_me(uuid) from public, anon;
grant execute on function public.link_worker_to_me(uuid) to authenticated;
