---
id: S13-02
titulo: Editar y archivar producto sin formulario roto
estado: implemented
depende_de: [S2-01, S2-02]
---

# S13-02 — Editar y archivar producto sin formulario roto

## Contexto y valor
En `/inventario/productos`, el botón "Editar" inyecta el `ProductForm` completo (grid de hasta
3 columnas) dentro de un `<tr><td colSpan={6}>` (`product-row.tsx:28-43`). Queda comprimido y
roto, sobre todo en móvil. La creación, en cambio, se renderiza a ancho completo sobre la
tabla. El dueño necesita confiar en que editar un producto se ve tan bien como crearlo.

## Alcance
- El formulario de edición de producto se renderiza a ancho completo sobre la tabla, con el
  mismo contenedor visual que el de creación — mismo patrón `?editar=<id>` de `/compras/ordenes`
  (S12-01): con el query param activo, el formulario de creación se reemplaza por el de edición.
- Confirmación (`confirm()` nativo) antes de archivar/reactivar un producto.
- Tests de `updateProduct` y `toggleProductActive` (hoy sin cobertura Vitest).

## NO-alcance (explícito)
- Los row-forms de proveedores, clientes, gastos y bodegas (mismo antipatrón `<td colSpan>`):
  se anotan como deuda técnica en BACKLOG, no se tocan en esta historia.
- Cambios de esquema, RLS o RPC — es capa web pura.
- Borrado físico de productos (el soft-delete vía `active` ya existe y no cambia).

## Criterios de aceptación
1. **Dado** un producto en la lista **cuando** pulso "Editar" **entonces** la URL pasa a
   `/inventario/productos?editar=<id>` y el formulario aparece a ancho completo sobre la tabla,
   precargado, sin `<td>` contenedor.
2. **Dado** el modo edición **cuando** guardo con éxito **entonces** vuelvo a
   `/inventario/productos` (sin query param) y la fila muestra los datos nuevos; **cuando**
   pulso "Cancelar" **entonces** vuelvo a la lista sin guardar.
3. **Dado** el modo edición **entonces** el formulario de creación no se renderiza (un solo
   campo "SKU" en pantalla) y el bloque "Stock inicial" (S13-01) sigue oculto.
4. **Dado** que pulso "Archivar"/"Reactivar" **cuando** rechazo la confirmación **entonces** no
   se envía nada; al aceptar, el producto cambia de estado y la fila se repinta.
5. **Responsive (ADR-025):** a 375px, `/inventario/productos?editar=<id>` no tiene scroll
   horizontal (`scrollWidth <= clientWidth + 1`) y el formulario arranca en 1 columna.

## Modelo de datos y migraciones
N/A — sin cambios de esquema.

## Políticas RLS requeridas
N/A — RLS existente de `products` (S2-02) sigue vigente sin cambios.

## Funciones RPC e invariantes
N/A — `updateProduct`/`toggleProductActive` siguen sobre la tabla `products` directo (sin
invariantes transaccionales nuevas), como ya está implementado.

## Casos borde
- `?editar=<id>` con un id que no existe o de otro tenant (RLS lo hace invisible): no se
  encuentra en los productos ya cargados → se muestra el formulario de creación, sin error.
- Doble click en "Archivar": el segundo submit es idempotente (mismo valor `active`).

## Consideraciones de seguridad (docs/arch/seguridad.md)
`updateProduct` ya valida con Zod (`updateSchema`) antes de tocar la BD. El `id` de `?editar`
solo se usa para buscar en memoria contra productos ya autorizados por RLS — nunca se usa para
autorizar ni se pasa crudo a una query nueva. Sin datos sensibles nuevos expuestos.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 2 | Vitest | src/actions/products.test.ts | `updateProduct` actualiza columnas explícitas por id, mapea 23505, valida con Zod |
| 4 | Vitest | src/actions/products.test.ts | `toggleProductActive` actualiza `active` según FormData y revalida |
| 1,2,3 | E2E | e2e/core-flow.spec.ts | crear producto → Editar → `?editar=` en URL → cambiar nombre → Guardar → nombre nuevo visible |
| 5 | Manual | Playwright ad-hoc, 375px | sin overflow en modo edición |

## Historial
- 2026-08-15 · creada (draft) y aprobada en la misma sesión vía plan mode (humano).
- 2026-08-15 · implementada. Verificación real: lint ✓, tsc ✓, Vitest 189/189 ✓, `npm run build` ✓,
  Playwright desktop 6/6 ✓ (incluido `core-flow.spec.ts` ampliado con edición), `responsive.spec.ts`
  mobile 3/3 públicas ✓ (bloque autenticado sigue `fixme` de S10-01, preexistente). Verificación
  manual ad-hoc con Supabase local + Playwright (script temporal, borrado al cerrar): editar
  fuera del `<tr>`, cancelar sin guardar, guardar cambios, 375px sin overflow
  (`scrollWidth <= clientWidth+1`), confirm rechazado no envía, confirm aceptado archiva/reactiva.
  Capturas revisadas.
