-- S22-03 — Asesor con IA: cada pregunta de un dueño y su respuesta, por empresa. Solo owner/admin
-- leen y escriben. Ver specs/S22-03-analisis-salud-y-asesor-ia.md. Idempotente.

create table if not exists public.advisor_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asked_by uuid not null default auth.uid() references auth.users(id),
  question text not null check (char_length(question) between 3 and 1000),
  answer text not null,
  range_from text not null check (range_from ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  range_to text not null check (range_to ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now()
);
create index if not exists advisor_questions_tenant_created_idx
  on public.advisor_questions (tenant_id, created_at desc);
create index if not exists advisor_questions_asked_by_idx on public.advisor_questions (asked_by);

alter table public.advisor_questions enable row level security;

drop policy if exists "advisor_questions_admin_select" on public.advisor_questions;
create policy "advisor_questions_admin_select" on public.advisor_questions for select
  using (public.user_is_tenant_admin(tenant_id));

-- Quien pregunta queda registrado como él mismo (no se puede firmar por otro).
drop policy if exists "advisor_questions_admin_insert" on public.advisor_questions;
create policy "advisor_questions_admin_insert" on public.advisor_questions for insert
  with check (public.user_is_tenant_admin(tenant_id) and asked_by = auth.uid());

grant select, insert on public.advisor_questions to authenticated, service_role;
