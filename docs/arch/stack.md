---
topic: stack-y-hosting
status: vigente
related: [multitenancy-rls.md, patron-rpc.md]
---

# Stack y hosting

## Stack (versiones reales en package.json)
- **Next.js 16** — App Router, TypeScript estricto, Server Components + Server Actions. `src/` con alias `@/*`.
- **React 19**, **Tailwind CSS 4**, **shadcn/ui** (componentes en `src/components/ui/`).
- **Supabase** — Postgres + Auth + RLS + Storage. SDK `@supabase/supabase-js` + `@supabase/ssr`.
- **Zod 4** — validación en el borde de toda Server Action.
- **Vitest** (unit) · **pgTAP** vía Supabase CLI (BD: RLS + RPC) · **Playwright** (e2e humo).

## Hosting (MVP en free tiers)
- **Vercel** free: hosting Next.js. Migrar a plan pago al comercializar (términos de uso).
- **Supabase** free: 500 MB de BD. ⚠️ **Pausa el proyecto tras ~7 días sin actividad** — antes de
  demos a clientes, verificar que el proyecto esté activo. Plan Pro ($25/mes) elimina la pausa.
- Costo proyectado post-validación: ~USD 45/mes (Vercel Pro + Supabase Pro).

## Entorno local
- `npm run dev` — app en http://localhost:3000
- `supabase start` (requiere Docker) — Postgres local + Studio; `supabase test db` corre pgTAP.
- Variables: copiar `.env.example` → `.env.local` (gitignored).

## Decisiones de descarte (detalle en DECISIONS.md)
- Django: superior en dominio ERP pero pierde en hosting gratis + doble stack para UI moderna.
- Flutter: débil en web back-office; reservado para app móvil de bodega en fase 2 — por eso
  toda la lógica de negocio vive en Postgres RPC (reutilizable desde cualquier cliente).
