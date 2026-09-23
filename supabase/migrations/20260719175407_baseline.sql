-- Baseline del proyecto Miel (Sprint 0).
-- Convenciones: ver docs/arch/convenciones-sql.md. Migraciones forward-only.
-- Las tablas de negocio empiezan en S1-01 (tenants, memberships).

-- gen_random_uuid() es nativo en Postgres 15+, pero dejamos pgcrypto explícito
-- para compatibilidad de entornos.
create extension if not exists "pgcrypto";
