---
topic: rpc-transaccional
status: vigente
related: [multitenancy-rls.md, convenciones-sql.md]
---

# Patrón RPC: invariantes transaccionales en Postgres

## Por qué
`supabase-js` no soporta transacciones multi-statement desde el cliente. Un ERP tiene
invariantes que exigen atomicidad (todo o nada). Por eso **toda operación de negocio con
invariantes es una función Postgres** llamada con una sola invocación `.rpc()`.
Beneficio extra: la lógica queda reutilizable para la futura app móvil (Flutter, fase 2).

## Operaciones que SIEMPRE son RPC (MVP)
| Función | Invariantes |
|---|---|
| `register_movement` | stock resultante ≥ 0; movimiento y actualización atómicos |
| `receive_purchase` | orden → recibida + movimientos de entrada por ítem, todo o nada |
| `register_supplier_payment` | pago ≤ saldo pendiente de la compra; saldo consistente |
| `confirm_sale` | stock ≥ 0; no confirmar dos veces; congela costo promedio en cada ítem; salidas + status, todo o nada |
| `register_customer_payment` | pago ≤ saldo de la venta; saldo consistente |
| `register_production` | stock de insumos ≥ 0; output_qty > 0; consumos costeados + entrada del terminado, todo o nada |
| `register_pos_sale` | sesión de caja abierta del usuario; Σ pagos = total; stock ≥ 0; consecutivo sin duplicados; venta+ítems+pagos+stock, todo o nada |
| `open_cash_session` | un usuario no tiene dos sesiones abiertas |
| `close_cash_session` | no cerrar dos veces; esperado calculado en BD; diferencia registrada |

## Plantilla de función

```sql
create or replace function public.register_movement(
  p_product_id uuid, p_warehouse_id uuid, p_qty numeric, p_kind text, p_note text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  -- validar invariantes con locks si aplica (select ... for update)
  -- insertar/actualizar; cualquier raise exception revierte todo
  return v_id;
end $$;
```

## Reglas
1. `security invoker` por defecto: la función corre con los permisos del usuario y **RLS aplica
   dentro de la función**. `security definer` solo con justificación en ADR.
2. La función NO recibe `tenant_id` del cliente: lo deriva de los registros implicados
   (que RLS ya limita al tenant del usuario). **Excepción (ADR-030):** en una RPC de *creación*
   sin registro previo del cual derivarlo (p. ej. `create_product_with_stock`), se acepta
   `p_tenant_id` explícito si (a) se resuelve en el servidor vía `getActiveTenant()`, nunca del
   cliente en bruto, y (b) la función es `security invoker` para que RLS siga validando la
   membership real.
3. Violación de invariante → `raise exception` con mensaje claro; la Server Action lo traduce
   a `{ ok: false, error }`.
4. Cada RPC nace con tests pgTAP de sus invariantes (caso feliz + cada violación + atomicidad).
5. Prohibido replicar el cálculo en TypeScript: la app solo valida forma (Zod), llama y muestra.
