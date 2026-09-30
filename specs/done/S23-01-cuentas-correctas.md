---
id: S23-01
titulo: Cuentas correctas — IVA recuperable, costo promedio, nómina 114-1, envíos, redondeo, anulación
estado: implemented
depende_de: [S22-02]
---

# S23-01 — Cuentas correctas

## Contexto y valor

Revisión de todas las cuentas del programa (sesión 2026-09-30). El humano aprobó arreglar los
errores y las inconsistencias: "este programa lo usarán empresas responsables de IVA, persona
jurídica o natural". Producción queda como está (oculta), fuera de alcance.

## Decisiones

1. **IVA recuperable (todas las empresas son responsables de IVA).** El costo nunca incluye IVA:
   al recibir una compra el kardex entra al costo del proveedor sin IVA. Los gastos llevan
   `tax_amount` (IVA descontable, opcional, ≤ monto); Resultados usa monto − IVA; el flujo de
   caja sigue con el monto pagado.
2. **Un solo costo: promedio ponderado del kardex.** `register_movement` actualiza
   `products.cost` al promedio tras cada entrada. Una entrada sin costo usa el promedio actual,
   o el costo de la ficha, o 0 (antes contaba cantidad sin valor y bajaba el promedio).
   Corrección de datos de prueba: entradas de compra con IVA → sin IVA; entradas sin costo → costo
   de la ficha; `products.cost` recalculado.
3. **Precio de venta lo pone la base.** `create_sale` toma precio, IVA y % de descuento del
   producto; el navegador solo manda producto y cantidad.
4. **Redondeo único.** Por línea: `round(qty·precio − descuento, 2)`, IVA `round(línea·tasa, 2)`;
   total = suma de partes redondeadas. Un `round2` compartido (con épsilon) en TS. Un único
   formato de dinero: 0 a 2 decimales (COP muestra decimales solo si los hay).
5. **Envío cobrado = ingreso** en Resultados (Ventas incluye envíos). El costo del transportista se
   anota en Gastos ("Transporte y envíos").
6. **Nómina 114-1.** Empresa `person_type` (`juridica` | `natural`, default `juridica`).
   Exonerado (salud 8,5 %, SENA, ICBF) si el salario < 10 SMMLV y (jurídica, o natural con ≥ 2
   trabajadores). Redondeo PILA: IBC al peso superior; cada subsistema al múltiplo de 100
   superior (salud y pensión: total del subsistema redondeado, la parte del empleador es la
   diferencia con la del trabajador redondeada al peso).
7. **Renta estimada.** `tenants.income_tax_rate` (default 35). Si el mes no tiene gastos
   "Impuesto de renta", Resultados muestra el estimado `max(UAI, 0) · tarifa` marcado "estimado".
   Los datos fiscales se editan en Resultados (owner/admin).
8. **Anular venta** (`cancel_sale`, owner/admin): venta confirmada/despachada/entregada →
   devuelve el stock al costo congelado, registra la devolución de cada cobro (monto negativo,
   efectivo exige caja abierta), estado `cancelled`. Borrador: solo cambia el estado. La caja no
   cuenta ventas anuladas.

## NO-alcance

Producción. Informe de IVA del mes. Devolución parcial.

## Tests

Vitest: `src/lib/money.test.ts`, `income-statement.test.ts`, `payroll-input.test.ts`, motor
(`colombiaEngine`), validación de ventas/gastos. pgTAP `supabase/tests/S23-01-cuentas-correctas.sql`.
