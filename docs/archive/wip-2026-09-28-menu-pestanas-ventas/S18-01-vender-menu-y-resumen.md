---
id: S18-01
titulo: Menú de Vender con pestañas y resumen útil del día
estado: approved
depende_de: [S5-10, S5-09, S15-02]
---

# S18-01 — Menú de Vender con pestañas y resumen útil del día

## Contexto y valor
`/ventas` es hoy una página vacía: 5 botones de igual peso y una caja punteada que dice "usa los
accesos de arriba" (`src/app/(app)/ventas/page.tsx`). Las subpáginas del módulo (POS, Pedidos,
Clientes, Caja, Por cobrar) no tienen navegación entre sí — para pasar de una a otra hay que volver
al menú lateral. Primera historia de la Épica E18 ("Vender en el día a día"), que busca ir
conectando los módulos del ERP empezando por Ventas, pensando en un dueño de PYME que vive en esta
pantalla todo el día.

## Alcance
- Componente `SectionTabs` reutilizable (pestañas de sección bajo un título de módulo).
- Layout `/ventas` con esas pestañas: Resumen · Punto de venta · Pedidos · Clientes · Caja ·
  Por cobrar (última oculta a `member`, mismo criterio que hoy).
- `/ventas` (Resumen) rediseñada: estado de caja con una acción primaria, métricas del día
  (vendido, N° ventas, ticket promedio), últimas 5 ventas.
- Helpers puros: `summarizeSales` (agregación) y `startOfTodayBogota` (corte de día en hora CO).
- **`/inicio` pierde la sección "Accesos directos"** (`QuickActions`, componente y test se
  eliminan): con "Vender" y "Agregar al inventario" hoy duplicando, con distinto peso visual y
  distinto destino (uno va directo a la acción, otro al módulo), la tarjeta "Vender"/"Inventario"
  de "Módulos" y las tarjetas de "Módulos". Hallazgo del humano probando la app real (2026-09-28):
  cada módulo pasa a ser el único camino, y es cada módulo el que expone su propia acción
  primaria arriba — `/ventas` ya la tendrá con esta misma historia (Cobrar/Abrir caja);
  `/inventario` ya la tiene ("+ Nuevo producto" → `/inventario/productos`, oculta a `member`,
  sin cambios). `/inicio` queda: saludo → Módulos → Resumen gerencial.

## NO-alcance (explícito)
- No se toca el POS (`pos-terminal.tsx`) ni sus cálculos — historia siguiente (S18-02).
- No se cruza con stock/inventario — historia siguiente (S18-03).
- No se tocan Comprar/Inventario/otros módulos (salvo quitar el atajo duplicado de Inicio; sus
  páginas propias no cambian).
- No se toca login/onboarding/auth.
- Sin migraciones, sin RLS nueva, sin RPC nueva, sin dependencias nuevas.

## Criterios de aceptación
1. **Dado** cualquier rol autenticado en `/ventas/*`, **cuando** carga la página, **entonces** ve
   pestañas de sección (Resumen/Punto de venta/Pedidos/Clientes/Caja, + Por cobrar si no es
   `member`) con la pestaña activa marcada (`aria-current="page"`).
2. **Dado** el usuario sin sesión de caja abierta, **cuando** entra a `/ventas`, **entonces** ve
   como única acción primaria "Abrir caja"; **dado** con sesión abierta, ve "Cobrar" como única
   acción primaria y la hora de apertura.
3. **Dado** ventas confirmadas/despachadas/entregadas hoy (hora Bogotá), **cuando** entra a
   `/ventas`, **entonces** ve vendido del día, número de ventas y ticket promedio calculados
   correctamente (ventas `draft`/`cancelled` no cuentan).
4. **Dado** sin ninguna venta hoy, **cuando** entra a `/ventas`, **entonces** ve un empty state
   con el mensaje y la acción "Cobrar" (no una tabla vacía muda).
5. **Dado** viewport 375px, **cuando** navega `/ventas` y sus pestañas, **entonces** no hay scroll
   horizontal del body (las pestañas scrollean horizontalmente ellas mismas si no caben).
6. **Dado** cualquier rol, **cuando** entra a `/inicio`, **entonces** no ve la sección de accesos
   directos (ni "Vender" ni "Agregar al inventario" como botón grande) — solo saludo, Módulos y
   (si no es `member`) Resumen gerencial; las tarjetas "Vender" e "Inventario" de Módulos siguen
   presentes y siguen llevando a sus módulos.

## Modelo de datos y migraciones
N/A — solo lecturas de `sales` y `cash_sessions`, tablas existentes; RLS ya las protege por tenant.

## Políticas RLS requeridas
N/A — sin tablas nuevas. Las consultas van filtradas por `tenant_id`/RLS existente, igual patrón
que `ventas/pedidos/page.tsx` y `ventas/caja/page.tsx`.

## Funciones RPC e invariantes
N/A.

## Casos borde
- Ventas de otro tenant nunca deben aparecer (cubierto por RLS existente, no por filtro en JS).
- Venta confirmada pero sin `issued_at` (no debería ocurrir — `confirm_sale` siempre lo fija) →
  `summarizeSales` no debe reventar si igual llega null; se excluye del corte de "hoy".
- Cero ventas totales (tenant nuevo) → `average` en 0, no `NaN`/división por cero.
- Redondeo: sumas en centavos (enteros) antes de convertir a decimal, para no arrastrar error de
  punto flotante en `formatMoney`.
- `member` nunca debe ver la pestaña "Por cobrar" ni el link, aunque tipee la URL directo (la
  página `/ventas/cuentas-por-cobrar` ya tiene su propio guard — solo se oculta el link, sin
  duplicar la autorización real).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Sin boundary de servidor nuevo (Server Action/RPC) — solo lecturas server-side ya autorizadas
  por RLS. `getActiveTenant()` sigue siendo la única fuente del tenant activo (nunca de query
  params/cliente).
- Sin datos sensibles nuevos expuestos: mismas columnas (`total`, `status`, `customer_id`,
  `receipt_number`) que ya se muestran en `/ventas/pedidos`.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 3, casos borde | Vitest | src/lib/sales/summary.test.ts | agregación correcta, excluye draft/cancelled, promedio 0 sin ventas, redondeo a centavos |
| 3 | Vitest | src/lib/format.test.ts | `startOfTodayBogota` da la medianoche de Bogotá, no UTC |
| 1 | Vitest | src/components/section-tabs.test.tsx | pestaña activa por `aria-current`, ítem condicional ausente para member |
| 1, 2, 4, 5 | E2E | e2e/core-flow.spec.ts | pestañas visibles al navegar `/ventas/*`; paso nuevo verifica estado de caja/resumen tras vender (no ejecutable en este entorno — sin Docker/Supabase local; queda para el humano) |
| 6 | Vitest | src/app/(app)/inicio/page.test.tsx o ampliación de las suites existentes | `/inicio` no renderiza accesos directos; Módulos/Resumen gerencial intactos |

## Historial
- 2026-09-28 · creada (approved vía plan mode con el humano en la misma sesión) · arranca Épica E18.
- 2026-09-28 · ampliada (criterio 6): el humano probó la app real (recién conectada a un proyecto
  Supabase cloud en blanco) y detectó que "Vender"/"Agregar al inventario" en Inicio duplican las
  tarjetas de Módulos con distinto destino — confuso. Decisión explícita del humano: cada módulo
  manda su propia acción primaria, Inicio se queda solo con Módulos + Resumen gerencial.
