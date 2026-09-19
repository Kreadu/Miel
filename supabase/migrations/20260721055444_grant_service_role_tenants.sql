-- Otorga permisos completos sobre tablas/secuencias (no rutinas: las RPCs de negocio se
-- ejecutan siempre como `authenticated`, con auth.uid() de un usuario real, nunca vía
-- service_role) a `service_role`. Ver ADR en docs/DECISIONS.md.
-- Uso: scripts de backend/operaciones fuera de src/ (p. ej. scripts/seed-demo.ts) que
-- necesitan limpiar, poblar catálogos base y post-datar filas para simular datos históricos.
-- `service_role` ya bypassa RLS por diseño de Supabase; este grant solo cubre el permiso de
-- tabla subyacente que PostgreSQL exige además del bypass de políticas.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
