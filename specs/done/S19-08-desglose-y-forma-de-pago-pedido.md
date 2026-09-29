---
id: S19-08
titulo: Desglose subtotal/IVA/total y forma de pago en el Pedido del catálogo
estado: implemented
depende_de: [S19-07]
---

# S19-08 — Desglose subtotal/IVA/total y forma de pago en el Pedido del catálogo

## Contexto y valor

El dueño miró el carrito armado desde el catálogo y no pudo verificar la suma (solo mostraba un
"Total estimado" sin desglose) — pidió mostrar IVA, subtotal y total a pagar por separado, y
poder elegir forma de pago (efectivo, tarjeta, transferencia) al armar el pedido.

**Verificado antes de tocar nada:** la matemática del total ya coincidía exactamente con la que
calcula `create_sale` en la base (`subtotal = Σ(qty·precio − descuento)`, `tax = Σ(línea·IVA%)`,
`total = subtotal + tax`) — no había un bug de cálculo, sino falta de desglose visible: con un
solo número no se podía verificar nada, y como los productos del catálogo nacen con IVA 0%
(S19-02), el total podía parecer "no corresponde" sin ver por qué.

## Alcance

- `CatalogPedidoCart`: cada línea muestra su propio subtotal (`qty × precio − descuento`), y al
  pie tres cifras separadas — **Subtotal**, **IVA**, **Total a pagar** — en vez de un solo
  "Total estimado".
- `sales` gana `payment_method text` (nullable, `check in ('cash','card','transfer','other')`) —
  **descriptivo, no transaccional**: no mueve dinero, no crea un `customer_payments`, no exige
  caja abierta ni bodega (a diferencia de `register_pos_sale`, que sí exige turno de caja — ver
  Casos borde). Mismos 4 valores y mismas etiquetas que ya usa `pos-terminal.tsx`
  (Efectivo/Tarjeta/Transferencia/Otro), para no inventar un vocabulario nuevo.
- `create_sale` RPC gana `p_payment_method text default null`, valida el enum si viene, lo guarda
  en la cabecera de `sales`.
- `CatalogPedidoCart` gana el selector "Forma de pago" (mismas 4 opciones), opcional.
- `SaleRow` (listado de Pedidos) muestra la forma de pago si quedó guardada.

## NO-alcance (explícito)

- **No es un cobro real**: no crea un registro en `customer_payments`, no afecta el saldo/balance
  del pedido — es solo una anotación de "cómo se espera/espera que se pague". El cobro real de un
  pedido con cliente sigue siendo "Registrar cobro" (`PaymentForm`, ya existente, post-confirmar).
- **No requiere turno de caja abierto**: a propósito, para que un tenant virtual-only (sin caja,
  S19-01) también pueda armar pedidos con forma de pago anotada. `register_pos_sale` (con caja)
  sigue siendo el camino para una venta física inmediata con cobro real — no se tocó.

## Casos borde

- Un pedido de mostrador (sin cliente) puede llevar forma de pago igual — no depende de tener
  cliente asignado (a diferencia de "Registrar cobro", que sí lo exige).

## Criterios de aceptación

1. **Dado** un pedido armado en el catálogo **cuando** se mira el carrito **entonces** se ven
   Subtotal, IVA y Total a pagar por separado, más el subtotal de cada línea.
2. **Dado** un pedido armado **cuando** se elige una forma de pago y se confirma **entonces**
   queda guardada en la venta y visible en el listado de `/ventas/pedidos`.
3. **Dado** un pedido sin forma de pago elegida **cuando** se confirma **entonces** igual se crea
   (el campo es opcional).

## Modelo de datos y migraciones

```sql
alter table public.sales
  add column if not exists payment_method text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_payment_method_check') then
    alter table public.sales
      add constraint sales_payment_method_check
      check (payment_method is null or payment_method in ('cash', 'card', 'transfer', 'other'));
  end if;
end $$;
```

`create_sale` se recrea (`create or replace`, misma firma + `p_payment_method text default null`
al final — no rompe llamadas existentes) guardando el valor tal cual en el insert de `sales`.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1 | manual (sin Playwright en este sandbox) | desglose visible y matemáticamente correcto |
| 2, 3 | manual (sin Playwright en este sandbox) | forma de pago se guarda y se ve; pedido sin forma de pago igual se crea |

**Nota (regla 9):** sin Docker en este sandbox, no se pudo correr `supabase test db`.

## Historial

- 2026-09-28 · pedido por el humano ("la sumatoria no da bien... hay que agregar el iva, subtotal
  y total a pagar, luego hay que agregar formas de pago"). Verificado que no había bug de cálculo
  (la matemática del cliente ya coincidía con `create_sale`); el desglose visible es lo que
  faltaba. Forma de pago implementada como campo descriptivo nuevo en `sales`, no como un cobro
  real — se reusaron las mismas 4 opciones que ya existían en `pos-terminal.tsx`.
