---
id: S10-02
titulo: Landing pública v2 (conversión a beta gratuita)
estado: implemented      # draft → approved → implemented
depende_de: []
---

# S10-02 — Landing pública v2

## Contexto y valor
La landing actual (`src/app/page.tsx`) es scaffolding: no explica el producto, no usa el logo
nuevo, no tiene footer ni SEO y no comunica el embudo (beta gratuita → adopción del ERP).
Se rediseña como landing premium, corta y explicativa que invite a crear cuenta, con efecto
visual diferenciador en CSS 3D + SVG (sin dependencias nuevas; Three.js descartado por
peso/LCP móvil).

## Alcance
- Rediseño completo de `/` con secciones en `src/components/landing/`: header sticky con
  `Logo`, hero con badge "Gratis durante la beta" + CTAs, mockup 3D del dashboard (componentes
  reales + sparkline SVG estático, sin recharts), patrón hexagonal SVG animado, beneficios
  (reutiliza copy actual), "cómo funciona" (3 pasos), CTA final y footer básico.
- Microanimaciones: reveals al scroll vía un único client component (`scroll-fx.tsx`,
  IntersectionObserver, ~1 KB de JS); tilt 3D con `animation-timeline: view()` + fallback.
- SEO: `metadata` propio en `page.tsx` + `src/app/opengraph-image.tsx` (`ImageResponse`).

## NO-alcance (explícito)
- Sección de precios/planes (Lite/Plus) — no existe billing; solo mensaje de beta gratuita.
- Testimonios o logos de clientes (no hay clientes reales; sería prueba social inventada).
- Escena 3D real (Three.js/WebGL) — evaluar a futuro con métricas de conversión.
- Cambios en `(auth)`, `(app)`, `manifest.ts` o `icon.svg` (estos dos son del humano).
- Analytics/tracking de conversión.

## Criterios de aceptación (máx ~5)
1. **Dado** un visitante en `/` **cuando** carga la página **entonces** ve, en orden: header
   con logo y acceso a login, hero con H1 y CTA primario a `/signup`, mockup del dashboard,
   beneficios, "cómo funciona" (3 pasos) y footer con enlaces a `/login` y `/signup`; el
   texto "Gratis durante la beta" es visible y no existe ninguna sección de precios.
2. **Dado** cualquier CTA primario ("Crear cuenta gratis") **cuando** se hace clic
   **entonces** navega a `/signup`; el enlace "Iniciar sesión" navega a `/login`.
3. **Dado** viewport 375px **cuando** se recorre la página completa **entonces** no hay
   scroll horizontal del body (gate `e2e/responsive.spec.ts` verde) y los grids colapsan a
   una columna (ADR-025).
4. **Dado** `prefers-reduced-motion: reduce` (o JS deshabilitado) **cuando** carga la página
   **entonces** todo el contenido es visible de inmediato, sin animaciones ni tilt.
5. **Dado** el `<head>` de `/` **entonces** el title contiene "Miel" y "ERP", y existen
   `og:title`, `og:description` y `og:image` (imagen servida con 200 por
   `/opengraph-image`).

## Modelo de datos y migraciones
N/A — página estática, sin datos ni Supabase.

## Políticas RLS requeridas
N/A.

## Funciones RPC e invariantes
N/A.

## Casos borde
- Sin JS: los reveals no ocultan contenido (estado inicial oculto solo bajo clase `.js` que
  añade el propio client component).
- Firefox (sin `animation-timeline`): el tilt usa fallback por IntersectionObserver
  (transición única al entrar en viewport).
- `rotateX` puede ensanchar el bounding box: contenedor con `overflow-x-clip` para no romper
  el criterio 3.
- Modo claro y oscuro: solo tokens semánticos; el ámbar `#fdb409` existe únicamente dentro
  del SVG del logo (identidad de marca).

## Consideraciones de seguridad (docs/arch/seguridad.md)
N/A con justificación: página pública estática sin inputs, formularios, datos de usuario ni
boundaries de servidor; los CTAs son `<Link>` a rutas internas fijas (`/signup`, `/login`),
sin redirects dinámicos.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Playwright | e2e/landing.spec.ts | headings/roles de cada sección en orden; texto beta visible; ausencia de sección precios |
| 2 | Playwright | e2e/landing.spec.ts | CTA → `/signup`; link login → `/login`; footer con ambos |
| 3 | Playwright | e2e/responsive.spec.ts (existente) | sin overflow horizontal a 375px en `/` |
| 4 | Playwright | e2e/landing.spec.ts | con `emulateMedia({ reducedMotion: "reduce" })` hero y footer visibles de inmediato |
| 5 | Playwright | e2e/landing.spec.ts | title y metas OG presentes; `GET /opengraph-image` → 200 |

## Supuestos registrados (miel-design)
- El tilt del mockup (~600 ms) y el drift del panal (loop ~24 s) exceden la regla de motion
  de la app (150–250 ms, sin loops decorativos); se amparan en la excepción explícita del
  skill `miel-design` para landings. Ambos respetan `prefers-reduced-motion`.
- Cero dependencias nuevas en `package.json` (por eso no hay ADR asociado).

## Historial
- 2026-07-23 · creada (draft)
- 2026-07-23 · aprobada por el humano (approved)
- 2026-07-23 · implementada y verificada (implemented)
