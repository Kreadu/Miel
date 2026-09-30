---
id: S20-03
titulo: Idiomas (es/en/fr) — módulo 3 de 7: Inventario
estado: implemented
depende_de: [S20-02]
---

# S20-03 — Idiomas: Inventario

## Contexto

Tercer módulo de E20 (ADR-040). Mismo patrón que S20-01/02: acciones y Zod devuelven claves, el
componente traduce; figuras colombianas con su sigla. El piloto ya tradujo parte de la ficha de
producto (`components/products/*`, `inventory-view.tsx`).

## Alcance

Pantallas de `src/app/(app)/inventario/`:
- Portada, vista por inventario (`[inventario]`), productos, grilla, archivados, historial.
- Movimiento de stock (entrada/salida/ajuste/traslado).
- Kardex por producto.
- Alertas de stock mínimo.
- Bodegas y sucursales (principal, formulario, fila).
- Receta de producto.
- Lo que quede sin traducir en `components/products/*` (filtro de categorías, botón de nuevo
  producto, textos sueltos de ficha/editor).

Acciones y validaciones: `actions/{products,stock,warehouses,catalog,recipes}.ts` y sus
`lib/validation/*.ts` → devuelven claves (`products.errors.*`, `stock.errors.*`, …).

Fuera de alcance: Producción (`actions/production.ts`, `/produccion`) — está oculta (S23-01); se
traduce cuando vuelva. Formato de dinero, cantidades y fechas sigue colombiano (ADR-040).

## Criterios

- Ninguna pantalla del alcance muestra texto en español fijo cuando el idioma es en/fr.
- Las acciones devuelven claves, nunca texto; los tests de acciones/validación comparan claves.
- `src/i18n/messages.test.ts` en verde (mismas claves en es/en/fr, sin vacíos).
- Tipos de producto, unidades, tipos de movimiento y estados de alerta traducidos.
- Verificación: lint, tsc, `npm test`; navegador del humano.

## Notas de implementación

- Claves nuevas: `inventory.*` (portada, `types.<id>.title/add`, `history`, `alertsPage`, `kardex`),
  `stock.*`, `warehouses.*`, `recipes.*`, `products.errors.*`, y en `catalog` los errores de
  categorías y `deleteConfirm`. Genéricas: `common.errors.textTooLong`, `common.errors.nameRequired`.
- `INVENTORIES` (`lib/inventories.ts`) ya no lleva `title`/`addLabel`: viven en los mensajes.
- `warehouseSummary` recibe el formateador de "Tel." para no fijar el idioma.
- `ArchivedProducts` pasó a componente de servidor asíncrono (usa `getTranslations`).
- Kardex: nombre traducido con la sigla ("Stock ledger (kardex)").
