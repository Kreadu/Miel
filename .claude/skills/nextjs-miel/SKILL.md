---
name: nextjs-miel
description: Buenas prácticas de Next.js (App Router) específicas del proyecto Miel (ERP multitenant con Supabase). Usar SIEMPRE antes de escribir o modificar código en src/ — páginas, componentes, Server Actions, clientes Supabase, formularios o data fetching.
---

# Next.js en Miel — convenciones obligatorias

Stack real del repo: Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind 4 · Zod 4 · @supabase/ssr. Verifica versiones en package.json antes de asumir APIs.

## Server vs Client Components
- **Server Component por defecto.** `"use client"` solo cuando hay interactividad real (estado, eventos, hooks de browser). Nunca en páginas completas: aísla la interactividad en el componente hoja más pequeño posible.
- El data fetching vive en Server Components (async/await directo) o Server Actions. Prohibido fetch de datos de negocio con `useEffect`.
- En Next 16 `params` y `searchParams` de páginas son **Promises**: `const { id } = await params`.

## Server Actions — el único canal de escritura
- Toda mutación pasa por una Server Action en `src/actions/<modulo>.ts` con `"use server"` al inicio del archivo.
- Patrón obligatorio por action:
  1. Validar la entrada con un schema Zod (`schema.safeParse`) — nunca confiar en el FormData/objeto crudo.
  2. Obtener el cliente Supabase de servidor con sesión del usuario (RLS aplica siempre).
  3. Operaciones con invariantes (stock, compras, pagos) → **una sola llamada `.rpc()`** a la función Postgres transaccional. Prohibido encadenar múltiples `.insert()/.update()` para una operación de negocio.
  4. Retornar un resultado tipado discriminado `{ ok: true, data } | { ok: false, error }` — no lanzar excepciones hacia el cliente.
  5. `revalidatePath()` de las rutas afectadas tras mutar.

## Clientes Supabase (@supabase/ssr)
- Dos fábricas únicas, no crear clientes ad hoc:
  - `src/lib/supabase/server.ts` → `createServerClient` con cookies (Server Components, Server Actions, Route Handlers).
  - `src/lib/supabase/client.ts` → `createBrowserClient` (solo Client Components; uso mínimo).
- **Jamás** importar o usar `SUPABASE_SERVICE_ROLE_KEY` en código de `src/`. Solo variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- La sesión se refresca en `middleware.ts` (patrón oficial de @supabase/ssr). No leer cookies de auth a mano.

## Multitenancy en la capa web
- Nunca filtrar por `tenant_id` a mano en queries "por seguridad": la seguridad la da RLS en la base. El filtro explícito solo cuando la semántica lo requiera (p. ej. usuario con varios tenants).
- Nunca aceptar `tenant_id` como input del cliente para decidir permisos; el tenant activo se resuelve en servidor desde la membresía del usuario.
- Recurso que RLS hace invisible (o id de otro tenant) → `notFound()`. Nunca un 403 ni un mensaje de permisos que revele que el recurso existe.

## Estructura y rutas
- Rutas de app autenticada bajo grupo `src/app/(app)/…`; auth/onboarding bajo `src/app/(auth)/…`.
- Componentes compartidos en `src/components/`, componentes shadcn/ui en `src/components/ui/` (no editar los generados salvo necesidad justificada).
- Schemas Zod compartidos en `src/lib/schemas/<modulo>.ts` — un solo lugar por entidad, reutilizados por actions y formularios.
- Tipos de la base: usar los tipos generados de Supabase (`src/lib/database.types.ts` cuando exista); no duplicar interfaces a mano.

## Formularios y UX
- Formularios con Server Actions + `useActionState` (React 19) para estados pending/error; no gestionar submit con fetch manual.
- Loading/errores por segmento: `loading.tsx` y `error.tsx` en las rutas que hagan fetch.
- UI con Tailwind 4 + shadcn/ui; sin CSS-in-JS ni librerías de UI adicionales sin ADR.

## Errores comunes a evitar en este repo
- `"use client"` en un layout o página entera para "arreglar" un hook → mover el hook a un componente hoja.
- Crear un cliente Supabase dentro de cada función → usar las fábricas de `src/lib/supabase/`.
- Lógica de negocio en el componente o en la action (cálculos de stock, saldos) → va en la función RPC de Postgres; la action solo valida, llama y revalida.
- `redirect()` dentro de un `try/catch` (lanza internamente y el catch se lo traga) → llamarlo fuera del try.
- Olvidar `revalidatePath` tras mutar → datos obsoletos en pantalla.
- Queries dentro de un bucle (N+1) → un solo `select` con embeds de PostgREST (`select('*, relacion(*)')`), un `.in()` batch, o el join dentro de la RPC.

## Antes de dar por terminado código de src/
`npm run lint` y `npx tsc --noEmit` limpios; tests de la historia en verde; reglas de AGENTS.md cumplidas (spec aprobada, sin service_role, sin lógica transaccional fuera de RPC).
