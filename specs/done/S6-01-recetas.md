---
id: S6-01
titulo: Recetas opcionales
estado: implemented
depende_de: [S2-02]
---

# S6-01 — Gestión de recetas por producto

## Contexto y valor
Como administrador quiero definir recetas (lista de materiales) para los productos terminados, para estandarizar el proceso de producción, conocer los insumos requeridos y sentar la base para registrar operaciones de transformación.

## Alcance
- Crear la tabla `recipe_items` que asocia componentes a un producto terminado.
- RPC atómica `save_recipe` para actualizar la lista completa de componentes.
- Restricción RLS: solo owner/admin pueden gestionar recetas (ver matriz de permisos).
- UI para ver y editar la receta en la ficha del producto, solo disponible para productos `finished`.

## NO-alcance (explícito)
- Registrar o ejecutar una orden de producción (eso es S6-02).
- Múltiples recetas o versiones por producto (el MVP contempla una única receta activa).
- Conversiones de unidades (todo es 1 a 1 en las unidades base definidas).

## Criterios de aceptación
1. **Dado** un producto de tipo `raw` o `resale` **cuando** intento acceder a su receta **entonces** la UI no me lo permite y la BD rechaza cualquier inserción.
2. **Dado** un producto `finished` sin receta **cuando** le agrego insumos con cantidades mayores a 0 **entonces** se guarda atómicamente la lista de componentes.
3. **Dado** un producto con receta existente **cuando** un admin envía una nueva lista de componentes **entonces** se reemplaza la receta anterior por la nueva sin dejar huérfanos.
4. **Dado** un rol `member` **cuando** intenta guardar o modificar una receta **entonces** recibe error de permisos (RLS `permission_denied`).
5. **Dado** un `admin` de un tenant A **cuando** intenta usar un componente del tenant B en su receta **entonces** la BD rechaza la operación.

## Modelo de datos y migraciones
Nueva tabla `recipe_items`:
- `id uuid`
- `tenant_id uuid`
- `product_id uuid references products`
- `component_product_id uuid references products`
- `qty numeric(14,3)`
- Trigger para validar que `product_id` tiene `kind = 'finished'` y que los componentes pertenecen al mismo `tenant_id`.

## Políticas RLS requeridas
- `recipe_items`: 
  - `SELECT`: Para todo el equipo (`tenant_id in user_tenant_ids()`).
  - `INSERT/UPDATE/DELETE`: Solo para owner/admin (`user_is_tenant_admin(tenant_id)`).

## Funciones RPC e invariantes
- `save_recipe(p_product_id uuid, p_items jsonb)`
  - Borra `recipe_items` actuales para el `product_id`.
  - Inserta los nuevos componentes desde `p_items`.
  - **Invariantes**: `products.kind = 'finished'`, cantidades `> 0`, todos los insumos pertenecen al mismo tenant, el usuario es admin/owner.

## Casos borde
- Intentar agregar el mismo componente dos veces en la misma receta -> debe rechazarse o sumarizarse (idealmente validado en frontend con Unique ID, respaldado por un índice único `product_id, component_product_id`).
- Cantidad igual a 0 o negativa -> rechazado por BD (`check qty > 0`).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Zod valida la estructura del payload `p_items` en la Server Action.
- RLS aplica aislamiento multitenant y autorización por rol.
- Se usan errores genéricos al cliente para ocultar detalles internos de PostgreSQL.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S6-01-recetas.sql | Rechazo de productos no finished |
| 2, 3 | pgTAP | supabase/tests/S6-01-recetas.sql | `save_recipe` atómico, qty > 0, limpieza de anteriores |
| 4 | pgTAP | supabase/tests/S6-01-recetas.sql | Bloqueo a rol `member` |
| 5 | pgTAP | supabase/tests/S6-01-recetas.sql | Aislamiento por tenant |
| UI/All | Vitest | src/lib/validation/recipes.test.ts | Validación Zod del payload |

## Historial
- 2026-07-20 · creada (draft)
