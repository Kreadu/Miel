---
id: S19-10
titulo: IVA por defecto del catálogo debe ser el estándar del país (19%), no 0
estado: implemented
depende_de: [S19-02]
---

# S19-10 — IVA por defecto del catálogo debe ser el estándar del país (19%), no 0

## Contexto y valor

El dueño notó que el IVA de los productos del catálogo salía en 0. Causa: S19-02 asumió (supuesto
documentado, sin confirmar) que el precio del alta simplificada era "final, sin IVA aparte" y
hardcodeó `tax_rate: 0`. Ese supuesto era incorrecto — el resto de la app ya asume 19% (IVA
estándar de Colombia) por default: la columna `products.tax_rate` (S2-02) y el formulario completo
de inventario (`product-form.tsx`) default a 19, no a 0.

## Alcance

- `createCatalogProduct` usa `DEFAULT_TAX_RATE_PERCENT = 19` (nueva constante compartida en
  `src/lib/validation/catalog.ts`) en vez de `0`.
- **Corrección de datos** para los productos ya creados por el catálogo con el default viejo:
  productos con SKU `CAT-%` y `tax_rate = 0` pasan a `tax_rate = 19` (identificables sin
  ambigüedad por el prefijo que genera `generateCatalogSku`, S19-02 — no toca productos creados
  desde `/inventario/productos`, que nunca usaron ese default incorrecto).

## NO-alcance (explícito)

- No se agrega un campo de IVA editable al alta simplificada del catálogo — sigue siendo 19% fijo
  ahí (editable después desde `/inventario/productos`, ficha completa, si un producto puntual
  necesita otra tasa — misma fila, mismo criterio que S19-02/ADR-035).
- No se modela "país de la empresa" como concepto nuevo (no hay columna `country` en `tenants`,
  solo `currency`) — se usa el mismo 19% fijo que ya asume el resto de la app para Colombia, sin
  construir una tabla de tasas por país no pedida.

## Criterios de aceptación

1. **Dado** un owner/admin **cuando** genera un producto nuevo desde el catálogo **entonces**
   queda con IVA 19%, no 0.
2. **Dado** los productos ya creados por el catálogo antes de esta corrección **cuando** se aplica
   la migración **entonces** su IVA pasa de 0 a 19%.
3. **Dado** un producto creado desde `/inventario/productos` (no del catálogo) **cuando** se
   aplica la migración **entonces** su IVA no cambia (el backfill solo toca SKUs `CAT-%`).

## Modelo de datos y migraciones

```sql
update public.products
set tax_rate = 19
where sku like 'CAT-%' and tax_rate = 0;
```

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1 | manual (sin Playwright en este sandbox) | generar un producto nuevo y ver IVA 19% en el pedido |
| 2, 3 | manual (sin Playwright en este sandbox) | tras aplicar, productos `CAT-%` en 19%, el resto sin tocar |

## Historial

- 2026-09-28 · reportado por el humano ("El iva sale en valor cero y debe tener el valor del país
  de la empresa"). Corregido el default (19%, IVA de Colombia, mismo que ya usa el resto de la
  app) y hecho el backfill de los productos ya creados con el default incorrecto.
