# Miel 🍯 — ERP SaaS multitenant

Software simple, intuitivo y moderno para que las empresas controlen su **inventario**,
registren **compras** y **pagos**, y entreguen a gerentes y directivos la información clave
para decidir informados. Mercado inicial: Colombia.

## Stack
Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth + RLS) · Tailwind 4 +
shadcn/ui · Zod · Vitest + pgTAP + Playwright. Detalle: `docs/arch/stack.md`.

## Quickstart

```bash
npm install
cp .env.example .env.local   # completar con las credenciales de Supabase
npm run dev                  # http://localhost:3000

# Base de datos local (requiere Docker)
supabase start               # Postgres local + Studio
supabase test db             # tests pgTAP (RLS + RPC)

# Calidad
npm run lint && npx tsc --noEmit && npm test
```

## Cómo se desarrolla este proyecto
Metodología **SDD + TDD** con sesiones agénticas: cada historia tiene una spec aprobada antes
de codificar, y tests escritos antes de implementar. Empieza por:

- `AGENTS.md` — reglas y protocolo de sesión (léelo primero).
- `docs/INDEX.md` — manifiesto de toda la documentación.
- `docs/BACKLOG.md` — historias y estado actual.

## Estado
Sprint 0 completado (arnés de ingeniería). Siguiente: Sprint 1 — fundación multitenant
(spec `specs/S1-01-tenants-auth.md` en draft, pendiente de aprobación).
