-- S26-01 — Datos de la empresa para documentos (logo, dirección, contacto) y el nombre de cada
-- usuario en cada empresa (para firmar lo que pide, aprueba o envía — E26).

alter table public.tenants
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists logo_url text;

alter table public.memberships
  add column if not exists display_name text;

-- Cada usuario cambia SOLO su propio nombre (la RLS de memberships solo deja escribir a admins).
create or replace function public.set_my_display_name(p_tenant_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if v_name = '' or length(v_name) > 80 then
    raise exception 'display_name_invalid' using errcode = 'P0001';
  end if;

  update public.memberships set display_name = v_name
  where user_id = auth.uid() and tenant_id = p_tenant_id;
  if not found then
    raise exception 'permission_denied' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.set_my_display_name(uuid, text) from public, anon;
grant execute on function public.set_my_display_name(uuid, text) to authenticated;

-- === Storage: logos de empresa, lectura pública (van en documentos), escritura solo admin ===
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

drop policy if exists "company_logos_public_read" on storage.objects;
create policy "company_logos_public_read" on storage.objects for select
  using (bucket_id = 'company-logos');

drop policy if exists "company_logos_admin_write" on storage.objects;
create policy "company_logos_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "company_logos_admin_delete" on storage.objects;
create policy "company_logos_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );
