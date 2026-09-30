---
id: S20-04
titulo: Idiomas (es/en/fr) — módulo 4 de 7: Comprar
estado: implemented
depende_de: [S20-03]
---

# S20-04 — Idiomas: Comprar

## Contexto

Cuarto módulo de E20 (ADR-040). Mismo patrón que S20-01/02/03: acciones y Zod devuelven claves,
el componente traduce; figuras colombianas con su sigla.

## Alcance

Pantallas de `src/app/(app)/compras/`:
- Portada de Comprar (incluye reponer desde alertas).
- Órdenes: formulario, selector de proveedor, fila, recibir, anular, historial.
- Proveedores: lista, formulario, fila; productos del proveedor (vincular/desvincular); cuenta
  del proveedor.
- Cuentas por pagar.

Acciones y validaciones: `actions/{purchases,suppliers,supplier-products}.ts` y sus
`lib/validation/*.ts` → devuelven claves (`purchases.errors.*`, `suppliers.errors.*`, …).

Fuera de alcance: formato de dinero y fechas sigue colombiano (ADR-040).

## Criterios

- Ninguna pantalla del alcance muestra texto en español fijo cuando el idioma es en/fr.
- Las acciones devuelven claves, nunca texto; los tests de acciones/validación comparan claves.
- `src/i18n/messages.test.ts` en verde (mismas claves en es/en/fr, sin vacíos).
- Estados de orden de compra y de pago traducidos.
- Verificación: lint, tsc, `npm test`; navegador del humano.

## Notas de implementación

- Claves nuevas: `purchases.*` (portada, `statuses`, `form`, `picker`, `history`, `errors`),
  `suppliers.*` (lista, formulario, `productsPage`, `account`, `errors`) y `payables.*`.
- Reutiliza: `sales.paymentMethod` (métodos de pago del proveedor), `products.errors.costNegative`/
  `taxRange`, `customers.errors.*` para email/teléfono/dirección, `common.errors.*`.
- La cuenta del proveedor ahora muestra estado y método traducidos (antes salía el código interno,
  p. ej. "ordered", "cash").
- NIT: se deja la sigla ("Tax ID (NIT)", "N° fiscal (NIT)").
