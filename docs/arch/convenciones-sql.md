---
topic: convenciones-sql
status: vigente
related: [multitenancy-rls.md, patron-rpc.md]
---

# Convenciones SQL y migraciones

## Naming
- Tablas: plural, snake_case, inglés (`products`, `stock_movements`). Columnas: snake_case.
- PK: `id uuid primary key default gen_random_uuid()`.
- Timestamps: `created_at timestamptz not null default now()`; `updated_at` con trigger
  compartido en tablas editables (catálogos y documentos en `draft`).
- FKs: `<singular>_id` (`product_id`). Índice explícito en toda FK y en `tenant_id`.

## Auditoría y tiempo (ADR-018)
- **Toda tabla de negocio** lleva `created_by uuid not null default auth.uid()`
  (FK a auth.users): quién vendió, descontó, registró el gasto o la producción.
- Agregaciones por mes (monthly_pnl, monthly_expenses) se calculan en la zona horaria del
  negocio — asunción MVP: `'America/Bogota'` (`date_trunc('month', ts at time zone 'America/Bogota')`).

## Tipos
- Dinero: `numeric(14,2)`. Cantidades: `numeric(14,3)`. **Nunca** `float`/`double`.
- Moneda por tenant (`tenants.currency`, default `'COP'`). IVA: `products.tax_rate numeric(5,2)`.
- Enums de dominio: `text` + `check` constraint (más simple de migrar que tipos enum).

## Migraciones (supabase/migrations/)
- Nombradas por el CLI: `supabase migration new <slug>`. Una migración = un cambio coherente.
- **Forward-only**: jamás editar ni borrar una migración aplicada; corregir con una nueva.
- Toda tabla nueva incluye en la MISMA migración: RLS habilitado + políticas + índices.

## Tests de BD (supabase/tests/, pgTAP)
- Se corren con `supabase test db` (local con Docker y en CI).
- `00-rls-guard.sql` es el test guardián: exige RLS habilitado y ≥1 política en toda tabla
  de `public`. No se modifica para "excluir" tablas sin ADR.
- Por historia: `S<sprint>-<id>-<slug>.sql` con aislamiento de tenant + invariantes de RPC.
- Patrón de test de aislamiento: crear 2 tenants + 2 usuarios, `set local role authenticated` +
  `set local request.jwt.claims` para simular cada usuario, verificar visibilidad cruzada = 0.
