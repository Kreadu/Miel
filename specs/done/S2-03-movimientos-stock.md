---
id: S2-03
titulo: Movimientos de stock
estado: implemented
depende_de: [S2-02]
---

# S2-03 — Movimientos de stock

## Contexto y valor
Permite registrar entradas, salidas y ajustes de inventario, garantizando la trazabilidad (Kardex inmutable) y previniendo que el stock llegue a valores negativos. Es la base transaccional sobre la cual operarán los módulos de compras, ventas y producción.

## Alcance
- Creación de la tabla `stock_movements` (el Kardex inmutable).
- Creación de la RPC `register_movement` que inserta un movimiento validando invariantes.
- Server Action y formulario de UI (básico) para que el operario registre movimientos manuales (entradas, salidas, ajustes).
- Tests pgTAP de la RPC y sus invariantes.

## NO-alcance (explícito)
- Vistas de reporte (Kardex, stock actual) o UI avanzada de listado y filtrado de inventario (eso corresponde a S2-04).
- Flujos complejos como compras o ventas (se abordan en los sprints E3 y E5).

## Criterios de aceptación (máx ~5; si necesitas más, parte la historia)
1. **Dado** un producto con stock insuficiente **cuando** intento registrar una salida (o un ajuste negativo mayor al stock) **entonces** la base de datos (RPC) rechaza la operación por el invariante `stock ≥ 0`.
2. **Dado** una entrada manual de stock **cuando** el operario la registra con un costo unitario **entonces** se crea el registro en `stock_movements` reflejando el documento/motivo de ajuste.
3. **Dado** una salida de stock **cuando** se registra **entonces** la RPC calcula automáticamente el costo promedio ponderado en ese instante y lo congela en el campo `unit_cost` del movimiento.
4. **Dado** un intento de escritura directa (Insert/Update) a la tabla `stock_movements` desde el cliente **cuando** se ejecuta **entonces** la base de datos lo rechaza (protegido por RLS).

## Modelo de datos y migraciones
Tabla `stock_movements`:
```sql
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('in', 'out', 'adjust', 'production_in', 'production_out')),
  qty numeric(14,3) NOT NULL,
  unit_cost numeric(14,2) NOT NULL,
  ref_type text, -- Ej: 'manual_adjust', 'purchase', 'sale'
  ref_id text,   -- ID del documento origen si aplica
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

-- Índices de desempeño sugeridos:
-- tenant_id, product_id, warehouse_id, created_at
```

## Políticas RLS requeridas
- `stock_movements`:
  - `SELECT`: Miembros del tenant (`tenant_id = (SELECT auth.jwt()->>'tenant_id')` o mediante la función que el proyecto use para el tenant isolation).
  - `INSERT / UPDATE / DELETE`: NINGUNA. La escritura directa queda bloqueada desde el cliente. Toda escritura se hará con la función RPC.

## Funciones RPC e invariantes
Firma de la RPC:
`register_movement(p_product_id uuid, p_warehouse_id uuid, p_kind text, p_qty numeric, p_unit_cost numeric, p_ref_type text, p_ref_id text, p_note text) RETURNS uuid`

**Invariantes protegidos:**
1. **Aislamiento Multitenant**: La función debe inyectar el `tenant_id` y `created_by` del usuario autenticado actual y validar que el `product_id` y `warehouse_id` pertenezcan a dicho tenant.
2. **Stock no negativo**: Antes de insertar una salida (`out`, `production_out`) o ajuste negativo, calcular el stock actual en esa bodega. Si el stock resultante es menor a 0, abortar la transacción lanzando un error.
3. **Cálculo de Costo Promedio**: Para movimientos de salida, ignorar `p_unit_cost` (o requerirlo nulo) y calcular el costo promedio ponderado de todo el histórico de movimientos de ese producto hasta ese momento, congelando este valor en la fila insertada.

## Casos borde
- Registro de salidas concurrentes: Si dos salidas ocurren al tiempo, la transacción debe serializarse adecuadamente para evitar condiciones de carrera que rompan el stock no negativo.
- Costo promedio con stock inicial de cero: Si se requiere calcular el costo y el stock es cero, el sistema debe manejarlo sin división por cero (por ejemplo, asumiendo 0 o el último costo registrado).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La RPC `register_movement` debe ser `SECURITY DEFINER` (con el `search_path` seguro) para poder insertar en una tabla donde el RLS deniega INSERTS públicos. Validará explícitamente el RLS manualmente en la primera línea.
- Server Actions validarán estrictamente los campos de entrada (`zod`), nunca pasando objetos crudos a la RPC. Los errores de invariante de BD se mapearán a errores de formulario amigables.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 3 | pgTAP | `supabase/tests/database/S2-03-stock-movements.test.sql` | Invariante de stock no negativo, cálculo correcto del costo promedio en salidas y correcta inyección de autoría. |
| 4 | pgTAP | `supabase/tests/database/S2-03-stock-movements.test.sql` | Las políticas RLS deniegan inserción o modificación manual de movimientos. |
| 2 | Vitest | `src/actions/stock.test.ts` (si aplica) | Server Action formatea y valida el esquema `zod` y procesa correctamente errores de base de datos. |

## Historial
- 2026-07-20 · creada (draft)
