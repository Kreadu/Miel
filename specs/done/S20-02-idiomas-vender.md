---
id: S20-02
titulo: Idiomas (es/en/fr) — módulo 2 de 7: Vender
estado: implemented
depende_de: [S20-01]
---

# S20-02 — Idiomas: Vender

## Contexto

Segundo módulo de E20 en orden de uso diario (ADR-040). Mismo patrón que S20-01: acciones y Zod
devuelven claves, el componente traduce; figuras colombianas traducidas con su sigla.

## Alcance

Pantallas de `src/app/(app)/ventas/`:
- Portada de Vender (`page.tsx`).
- Pedidos: lista, fila, carrito desde catálogo, confirmar, enviar, entregar, cobrar, anular,
  sección de entrega.
- Clientes: lista, fila, formulario, ficha (`[id]`) con interacciones.
- Caja: abrir, cerrar, página.
- Cuentas por cobrar.
- Envíos: tarifas (formulario, fila, campos).
- Catálogo: solo lo que quede sin traducir (el piloto ya usa `getTranslations`), incl. selector
  de moneda y grilla.
- Estados `loading.tsx` con texto, si lo tienen.

Acciones y validaciones: `actions/{sales,customers,cash-sessions,customer-payments,shipping,interactions}.ts`
y sus `lib/validation/*.ts` → devuelven claves (`sales.errors.*`, `customers.errors.*`, …).

Fuera de alcance: Finanzas (`/finanzas`) va con Resultados (S20-06); formato de dinero y fechas
sigue colombiano (ADR-040).

## Criterios

- Ninguna pantalla del alcance muestra texto en español fijo cuando el idioma es en/fr.
- Las acciones devuelven claves, nunca texto; los tests de acciones/validación comparan claves.
- `src/i18n/messages.test.ts` en verde (mismas claves en es/en/fr, sin vacíos).
- Estados de venta/envío/caja traducidos (borrador, confirmada, enviada, entregada, anulada…).
- Verificación: lint, tsc, `npm test`; muestra de pantallas en es/en/fr (curl con cookie o
  navegador del humano).

## Notas de implementación

- Claves nuevas: `sales.*` (portada, `orders`, `cart`, `deliverySection`, `status`, `paymentMethod`,
  `delivery`, `errors`), `customers.*`, `interactions.*`, `cash.*`, `payments.errors.*`,
  `receivables.*`, `shipping.*`, y en `catalog` el selector de moneda (`currencies`, errores de
  `actions/exchange-rate.ts`). Genéricas en `common.errors` (`permissionDenied`, `noteTooLong`,
  `nameTooLong`, `unknown`).
- Quedaron sin uso y se borraron: `DELIVERY_LABEL` (`lib/shipping.ts`) y los nombres de moneda
  de `SUPPORTED_CURRENCIES` (`lib/currency.ts`); ahora viven en los mensajes.
- Estados de venta en la ficha del cliente unificados en femenino ("Confirmada"), igual que Pedidos.
- Siglas colombianas sin traducir: NIT/CC/CE; CxC → "AR" en inglés.
