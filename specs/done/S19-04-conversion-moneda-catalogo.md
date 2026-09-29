---
id: S19-04
titulo: Conversión de moneda (vista) en el Catálogo
estado: implemented
depende_de: [S19-02]
---

# S19-04 — Conversión de moneda (vista) en el Catálogo

## Contexto y valor

Ejemplo del dueño: una empresa colombiana ingresa precios en pesos (COP), pero alguien de Europa
quiere verlos en euros — "apretar y que haga la conversión". Es una conversión de **vista**, no de
cobro real (pagos siguen pospuestos, E19 no los toca todavía).

## Alcance

- `tenants` ya tenía una columna `currency` (S1-01, `default 'COP'`, nunca usada hasta ahora) —
  se expone en `ActiveMembership`/`getActiveTenant()` como la moneda base del tenant.
- `/ventas/catalogo` gana un selector de moneda (COP, USD, EUR, GBP, MXN, ARS, BRL, CLP, PEN —
  lista fija, no exhaustiva de "todas las del mundo" pero cubre los casos reales pedidos). Al
  cambiarlo, todas las tarjetas recalculan y muestran el precio convertido.
- Nueva Server Action `getExchangeRate(base, target)`: pide la tasa a una API pública gratuita
  (`open.er-api.com`, sin key) **del lado del servidor** — no del navegador, así el CSP
  (`connect-src`) no necesita agregar un dominio externo nuevo. Cachea 1 hora
  (`next: { revalidate: 3600 }`) para no golpear la API en cada cambio de selector.
- Aviso visible junto al selector: la conversión es aproximada (tasa de mercado, no la que
  cobraría un medio de pago real) — evita que alguien la lea como un precio de cobro exacto.

## NO-alcance (explícito)

- **Pagos/checkout en la moneda convertida**: siguen sin existir. Esto es solo para que el
  visitante entienda el precio en su moneda.
- **Guardar el precio en varias monedas**: el precio sigue siendo una sola columna
  (`products.price`) en la moneda base del tenant — la conversión se calcula al vuelo, no se
  persiste.
- Lista exhaustiva de divisas del mundo (ISO 4217 completo): se cubre un set razonable de
  monedas comunes; agregar más es solo extender un array, sin cambio de arquitectura.

## Casos borde

- La API de tasas no responde o no tiene la moneda pedida: el selector muestra un error corto,
  las tarjetas siguen mostrando el precio en la moneda base (no rompe la página).

## Criterios de aceptación

1. **Dado** cualquiera **cuando** entra a `/ventas/catalogo` **entonces** ve el precio en la
   moneda base del tenant (igual que antes de esta historia).
2. **Dado** cualquiera **cuando** elige "EUR" en el selector **entonces** todas las tarjetas
   recalculan su precio (con descuento aplicado) a euros, usando la tasa del momento.
3. **Dado** un fallo de red al pedir la tasa **cuando** ocurre **entonces** se ve un mensaje de
   error y los precios vuelven/quedan en la moneda base, sin romper la página.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–3 | manual (sin Playwright en este sandbox; depende de una API externa real) | verificado a mano por el humano vía `npm run dev` |

## Historial

- 2026-09-28 · aprobada por el humano en la misma sesión, con el ejemplo Colombia→Europa como
  criterio guía.
