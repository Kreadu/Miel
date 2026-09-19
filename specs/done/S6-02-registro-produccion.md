---
id: S6-02
titulo: Registro de Producción
estado: implemented
depende_de: [S6-01, S2-03]
---

# S6-02 — Registro de Producción

## Contexto y valor
Permite al operario registrar la fabricación de un producto terminado. Automatiza el descuento del inventario de los insumos consumidos y la entrada del producto final, valorizando correctamente su costo según los consumos reales.

## Alcance
- Interfaz gráfica para registrar una orden de producción, seleccionando producto terminado, bodega origen/destino y cantidad a producir.
- Carga dinámica de consumos sugeridos basados en la receta del producto (creada en S6-01), permitiendo editar las cantidades, agregar o quitar insumos.
- RPC `register_production` atómica que encapsula las salidas de stock de insumos y la entrada de stock del producto terminado.
- Cálculo automático del costo unitario del producto terminado: suma de `costo_promedio_insumo * cantidad_consumida` dividida entre la cantidad producida.
- Actualización del costo promedio (`unit_cost`) del producto terminado en el catálogo.

## NO-alcance (explícito)
- Producción multi-etapa o "work in progress" (WIP).
- Costos de mano de obra o indirectos de fabricación (CIF). Solo costo directo de materiales.
- Gestión de desperdicios o mermas explícitas (se asumen implícitas en el consumo editado).

## Criterios de aceptación
1. **Dado** un formulario de producción **cuando** selecciono un producto con receta y una cantidad **entonces** la lista de consumos sugeridos se autocompleta proporcionalmente.
2. **Dado** un registro válido con consumos **cuando** confirmo la producción **entonces** se reduce el stock de los insumos en la bodega y se incrementa el stock del producto terminado.
3. **Dado** consumos que superan el stock disponible en la bodega **cuando** intento registrar **entonces** la base de datos rechaza la operación por invariante de stock.
4. **Dado** un registro exitoso **cuando** se crea el ingreso del producto terminado **entonces** su costo en ese movimiento es igual a `Σ (cantidad_insumo * costo_unitario_insumo) / cantidad_producida`.

## Modelo de datos y migraciones
Esta historia NO crea tablas nuevas. Reutiliza la infraestructura de movimientos (`inventory_movements`) creada en S2-03.
- Los consumos serán entradas en `inventory_movements` con `type = 'out'`, `reason = 'production_consumption'`, y `reference` ligada a una identificación de la producción (p.ej. un UUID único generado para agrupar el lote de la operación).
- El producto terminado será una entrada en `inventory_movements` con `type = 'in'`, `reason = 'production_output'`, compartiendo el mismo `reference`.

*Nota: Puesto que no se requiere (por ahora) listar un historial complejo de "órdenes de producción" separadas, una producción se considera simplemente un lote atómico de movimientos entrelazados por el campo `reference`.*

## Políticas RLS requeridas
N/A (no hay tablas nuevas). La inserción de movimientos sigue usando la función `security definer` base o se integrará en la nueva RPC que hace bypass de RLS pero restringe lógicamente.

## Funciones RPC e invariantes
**Firma:**
`register_production(p_tenant_id uuid, p_warehouse_id uuid, p_product_id uuid, p_output_qty numeric, p_consumptions jsonb)`

**Invariantes a proteger:**
- `product_not_finished`: `p_product_id` debe tener `kind = 'finished'`.
- `warehouse_mismatch`: La bodega debe pertenecer al `tenant_id`.
- `invalid_quantity`: `p_output_qty > 0` y todos los consumos `> 0`.
- `stock_insufficient`: Garantizado implícitamente por el constraint de BD o por reuso de `register_movement`.

## Casos borde
- **Producto terminado sin receta**: Se permite la producción; el usuario debe agregar los consumos manualmente en la UI.
- **Producción sin consumos**: Debe fallar; no se puede producir de la nada (valida al menos 1 insumo).
- **Insumo con costo 0**: El cálculo avanza; el producto terminado arrastrará un costo 0 parcial o total para ese ítem.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- **Boundary**: El Server Action usará Zod para validar tipos, UUIDs y arrays de consumos (evitando inyecciones JSON).
- **Errores**: Las excepciones de la RPC (`product_not_finished`, `stock_insufficient`) serán mapeadas en el servidor a mensajes amigables genéricos, sin exponer detalles internos de la BD.
- **Roles**: La UI y la acción permitirán ejecución a roles `owner`, `admin` y `member` (cualquier operario).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 2, 3, 4 | pgTAP | `supabase/tests/S6-02-produccion.sql` | Rechazos por stock/kind, cálculo exacto de costos y atomicidad de inventario. |
| 1, UI | Vitest | `src/lib/validation/production.test.ts` | El schema Zod para el array de consumos. |

## Historial
- 2026-07-20 · creada (draft)
