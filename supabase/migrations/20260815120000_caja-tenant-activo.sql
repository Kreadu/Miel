-- S12-04 — open_cash_session recibía el tenant con `select tenant_id from memberships
-- where user_id = ... limit 1` (sin order by): un usuario con membership en varias empresas
-- podía abrir caja en un tenant distinto al que tiene activo en pantalla, dependiendo del
-- orden físico de filas en Postgres. Ahora recibe p_tenant_id explícito (el server action lo
-- resuelve con getActiveTenant(), ya validado contra memberships) y la RPC revalida por
-- defensa en profundidad que el tenant pertenece al usuario. Ver
-- specs/S12-04-caja-tenant-activo.md.

drop function public.open_cash_session(numeric);

create function public.open_cash_session(
  p_opening_amount numeric,
  p_tenant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_session_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_opening_amount is null or p_opening_amount < 0 then
    raise exception 'opening_amount_invalid' using errcode = 'P0001';
  end if;

  if p_tenant_id is null or not exists (
    select 1 from public.memberships
    where user_id = v_user_id and tenant_id = p_tenant_id
  ) then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cash_sessions
    where opened_by = v_user_id and tenant_id = p_tenant_id and status = 'open'
  ) then
    raise exception 'cash_session_already_open' using errcode = 'P0001';
  end if;

  insert into public.cash_sessions (
    tenant_id, opened_by, opening_amount, created_by
  ) values (
    p_tenant_id, v_user_id, p_opening_amount, v_user_id
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.open_cash_session(numeric, uuid) from public, anon;
grant execute on function public.open_cash_session(numeric, uuid) to authenticated;
