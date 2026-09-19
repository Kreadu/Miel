---
id: S5-01
titulo: Gestión de clientes
estado: approved
depende_de: [S1-04]
---

# S5-01 — Gestión de clientes

## Contexto y valor
Como administrador quiero gestionar la base de clientes (documento, contacto) para poder registrar a quién le vendo, hacer seguimiento de cartera (cuentas por cobrar) y mantener un historial CRM.

## Alcance
- CRUD de clientes (tabla `customers`).
- Campos: `name`, `doc_type` (NIT, CC, CE, Otro), `doc_number`, `email`, `phone`, `address`, `note`.
- Identificación única parcial: `doc_type` + `doc_number` únicos por tenant (si el documento está presente).
- Soft-delete (columna `active`).
- UI de listado y formulario de creación/edición en `/(app)/ventas/clientes`.
- Políticas RLS por rol: visibilidad para todo el equipo, escritura (crear/editar/archivar) solo para administradores y dueños.

## NO-alcance (explícito)
- Historial de compras del cliente (eso pertenece a S5-05).
- Cuentas por cobrar y pagos de clientes (S5-04).
- Creación de clientes por parte de vendedores (el rol `member` no puede gestionar catálogos según la matriz de permisos).

## Criterios de aceptación (máx ~5; si necesitas más, parte la historia)
1. **Dado** un owner/admin **cuando** crea un cliente con un `doc_type` y `doc_number` ya existente en su tenant **entonces** el sistema rechaza la creación con un error amigable.
2. **Dado** un owner/admin **cuando** archiva (soft-delete) un cliente **entonces** este ya no aparece como activo, pero podrá ser referenciado en ventas pasadas o futuras si se conoce su ID.
3. **Dado** un tenant nuevo **cuando** lista clientes **entonces** no ve los clientes de otros tenants (aislamiento).
4. **Dado** un member **cuando** entra a la página de clientes **entonces** ve la lista pero no los botones de crear, editar o archivar.

## Modelo de datos y migraciones
Tabla `customers`:
- `id` (uuid, pk)
- `tenant_id` (uuid, fk a tenants)
- `name` (text, not null)
- `doc_type` (text, check in 'nit', 'cc', 'ce', 'other')
- `doc_number` (text)
- `email` (text)
- `phone` (text)
- `address` (text)
- `note` (text)
- `active` (boolean, default true)
- `created_at` (timestamptz, default now())
- `created_by` (uuid)
- `updated_at` (timestamptz, default now())
- Índice único parcial: `UNIQUE(tenant_id, doc_type, doc_number) WHERE doc_number IS NOT NULL AND doc_number != ''`.
- Triggers: `set_updated_at`.

Referencia a `docs/data-model.md`.

## Políticas RLS requeridas
- `SELECT`: `tenant_id IN (SELECT public.user_tenant_ids())` (todo el equipo del tenant).
- `INSERT`, `UPDATE`: `public.user_is_tenant_admin(tenant_id)` (solo owner/admin).
- `DELETE`: Sin política (se usa soft-delete vía `active`).

## Funciones RPC e invariantes
N/A (Es un CRUD estándar).

## Casos borde
- Cliente sin documento (`doc_number` es null o vacío): Se permite crear varios clientes sin documento en el mismo tenant.
- Se requiere que el front-end formatee y exponga de manera limpia los errores de restricción de unicidad para no asustar al usuario con mensajes de base de datos (`23505`).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Los datos de entrada se validan en el Server Action con Zod (`src/lib/validation/customers.ts`).
- Las políticas RLS restringen la escritura por rol de forma segura en BD, sin depender exclusivamente del ocultamiento en UI.
- Errores internos (como colisión de documento) se capturan en el Server Action y devuelven un mensaje genérico controlado, nunca detalles crudos de PostgreSQL al cliente.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S5-01-clientes.sql | Rechazo de `doc_type` y `doc_number` duplicado en el mismo tenant; validación parcial de nulls (varios sin documento son permitidos). |
| 2 | pgTAP | supabase/tests/S5-01-clientes.sql | Actualización del campo `active` restringida por RLS. |
| 3 | pgTAP | supabase/tests/S5-01-clientes.sql | Aislamiento multitenant de la política SELECT. |
| 4 | Vitest | src/lib/validation/customers.test.ts | Validaciones Zod del esquema de cliente y restricciones de datos. |

## Historial
- 2026-07-20 · creada (draft)
