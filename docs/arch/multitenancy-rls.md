---
topic: multitenancy-y-rls
status: vigente
related: [convenciones-sql.md, patron-rpc.md, ../data-model.md]
---

# Multitenancy: esquema compartido + RLS

## Modelo
- Un solo esquema Postgres (`public`). **Toda tabla de negocio lleva `tenant_id uuid not null`**
  con FK a `tenants(id)`.
- `tenants` — la empresa cliente. `memberships` — une `user_id` (auth.users) ↔ `tenant_id` ↔ `role`.
- Roles por tenant: `owner` (dueño, facturación), `admin` (gestión completa), `member` (operativo).
- La frontera de seguridad es **RLS en la base de datos**, no el código de aplicación.

## Patrón de políticas (obligatorio en toda tabla de negocio)

Función auxiliar única (creada en migración base, `security definer`, `stable`):

```sql
create or replace function public.user_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from memberships where user_id = auth.uid()
$$;
```

Política estándar por tabla:

```sql
alter table <tabla> enable row level security;

create policy "<tabla>_tenant_select" on <tabla> for select
  using (tenant_id in (select user_tenant_ids()));

create policy "<tabla>_tenant_write" on <tabla> for all
  using (tenant_id in (select user_tenant_ids()))
  with check (tenant_id in (select user_tenant_ids()));
```

Restricciones por rol (p. ej. solo `admin+` borra) se añaden como políticas adicionales
sobre `memberships.role` — se definen en la spec de cada historia.

## Reglas
1. Tabla nueva sin RLS + política = CI en rojo (test guardián pgTAP).
2. Cada tabla nueva lleva su test pgTAP de aislamiento: usuario del tenant A no ve filas del tenant B.
3. El cliente **nunca** decide el tenant: `tenant_id` se resuelve en servidor desde `memberships`.
4. `service_role` solo en scripts administrativos fuera de `src/` (seeds, mantenimiento).
5. No filtrar por `tenant_id` a mano en la app "por seguridad" — eso es responsabilidad de RLS.
