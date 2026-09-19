---
id: S5-07
titulo: Interacciones postventa CRM
estado: implemented
depende_de: [S5-05]
---

# S5-07 — Interacciones postventa CRM

## Contexto y valor
Como cualquier miembro del equipo (owner/admin/member) quiero registrar interacciones
postventa con un cliente (seguimiento, reclamo, promoción, nota libre) para cerrar el ciclo
CRM: antes de la venta hay pedido en borrador, durante hay confirmación y pagos, después hay
despacho/entrega (S5-06) y postventa hay interacciones. Sin esto, la ficha del cliente (S5-05)
solo muestra transacciones, sin el trato humano que explica la relación comercial (origen:
ADR-015, caso SIDERAL).

## Alcance
- Tabla `customer_interactions`: registro **append-only** (crear + ver, sin editar/borrar) de
  interacciones ligadas a un cliente.
- Tipos (`kind`): `note` (nota libre), `followup` (seguimiento), `complaint` (reclamo),
  `promo` (promoción).
- Cualquier rol del tenant (owner/admin/member) registra y ve interacciones — matriz de
  permisos (`docs/arch/permisos-roles.md`): "CRM: ver/registrar interacciones, historial de
  cliente" = ✔ para los tres roles.
- Sección "Interacciones postventa" en la ficha del cliente (`/ventas/clientes/[id]`), separada
  de la línea de tiempo de ventas/pagos existente (S5-05), orden cronológico descendente.
- Formulario de registro inline en la misma ficha.

## NO-alcance (explícito)
- Editar o eliminar una interacción ya registrada (append-only; corregir = registrar una nueva).
- Fusionar interacciones en el mismo timeline de ventas/pagos de S5-05 (sección propia, decisión
  de UI confirmada con el humano).
- Notificaciones, recordatorios o automatización de seguimientos (Fase 2 — automatización de
  pedidos/mensajería, ADR-015).
- Adjuntar archivos o multimedia a una interacción.

## Criterios de aceptación (máx ~5; si necesitas más, parte la historia)
1. **Dado** un usuario con rol `member` del tenant **cuando** registra una interacción de tipo
   `complaint` en un cliente de su tenant **entonces** se persiste con su `created_by` y
   `occurred_at`, y aparece en la ficha del cliente.
2. **Dado** un intento de registrar una interacción con `kind` fuera de
   `note|followup|complaint|promo`, o con `note` vacío **entonces** el sistema la rechaza (Zod
   en el boundary y `CHECK` en BD como frontera real).
3. **Dado** un usuario de un tenant distinto **cuando** intenta ver o insertar una interacción
   sobre un cliente que no es de su tenant **entonces** RLS lo impide (aislamiento; el cliente
   ajeno tampoco existe para él en las opciones del formulario).
4. **Dado** un cliente con varias interacciones registradas **cuando** se abre su ficha
   **entonces** la sección "Interacciones postventa" las lista en orden cronológico descendente,
   con tipo y fecha visibles.
5. **Dado** una interacción ya registrada **cuando** cualquier usuario del tenant intenta
   actualizarla o borrarla directamente (fuera de la UI, vía API) **entonces** RLS lo rechaza —
   no existen políticas de `UPDATE`/`DELETE` (append-only real, no solo por convención de UI).

## Modelo de datos y migraciones
Tabla `customer_interactions` (referencia `docs/data-model.md:95`):
- `id` (uuid, pk, default `gen_random_uuid()`)
- `tenant_id` (uuid, fk `tenants`, not null)
- `customer_id` (uuid, fk `customers`, not null)
- `kind` (text, not null, `check (kind in ('note','followup','complaint','promo'))`)
- `note` (text, not null — sin `CHECK` de no-vacío en BD; la cadena vacía se rechaza en el
  boundary Zod, que es donde vive la validación de forma de texto; BD solo protege el dominio
  cerrado de `kind`, consistente con el patrón ya usado en el resto del esquema)
- `occurred_at` (timestamptz, not null, default `now()`)
- `created_by` (uuid, fk `auth.users`, not null, default `auth.uid()`)
- `created_at`, `updated_at` (timestamptz, not null, default `now()`, trigger `set_updated_at`)
- Índice `customer_interactions_customer_id_idx` en `customer_id` (la ficha filtra por cliente).
- Índice `customer_interactions_tenant_id_idx` en `tenant_id` (patrón estándar del repo).

Nota de diseño: `updated_at` se incluye por convención uniforme del repo (todas las tablas la
llevan) aunque en la práctica nunca cambia tras el insert, al no existir política de `UPDATE`.

## Políticas RLS requeridas
- `SELECT`: `tenant_id in (select public.user_tenant_ids())` — todo el equipo del tenant.
- `INSERT`: `with check (tenant_id in (select public.user_tenant_ids()))` — **todo el equipo**,
  no solo admin (diferencia deliberada frente a `customers`/`suppliers`/`products`, que son
  catálogos restringidos a admin; aquí el registro operativo lo hace cualquier rol, igual que
  `customer_payments` de S5-04).
- `UPDATE`, `DELETE`: sin política — denegado por defecto (append-only real).
- `GRANT SELECT, INSERT ON public.customer_interactions TO authenticated, service_role;`

## Funciones RPC e invariantes
N/A. No hay invariante transaccional (no toca stock, saldos ni totales calculados) — inserción
directa protegida por RLS, igual que el patrón de S5-01 pero con `INSERT` abierto a todo el
tenant en vez de restringido a admin.

## Casos borde
- Cliente inexistente o de otro tenant como `customer_id`: la FK exige que exista, y RLS de
  `customers` ya impide verlo/seleccionarlo en el formulario; si se fuerza el insert igual con
  un `customer_id` ajeno válido, la política de `customer_interactions` solo exige que
  `tenant_id` (el del emisor) esté en sus tenants — **se debe además validar en el boundary
  (Server Action) que el cliente pertenece al tenant activo antes de insertar**, para no confiar
  solo en que el select del formulario ya lo filtró.
- `occurred_at` en el futuro: se permite (registro de un seguimiento agendado ya realizado o
  nota con fecha manual); no se valida contra `now()`.
- Cliente sin ninguna interacción: la sección muestra estado vacío, no error.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary con Zod (`src/lib/validation/interactions.ts`): `customer_id` uuid, `kind` enum
  cerrado, `note` recortado y no vacío con longitud máxima.
- Insert con columnas explícitas en el Server Action (nunca spread del `FormData`/input crudo).
- El Server Action re-valida que `customer_id` pertenece al tenant activo (ver Casos borde) antes
  de insertar — defensa en profundidad, no confía solo en RLS ni en que la UI ya filtró.
- Errores internos de BD nunca llegan crudos al cliente; se mapean a un mensaje genérico.
- RLS es la frontera real de autorización; el gating de UI (mostrar/ocultar el form) no aplica
  aquí porque los tres roles tienen el mismo permiso — no hay nada que ocultar por rol.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S5-07-interacciones-crm.sql | `member` del tenant inserta correctamente; `created_by`/`occurred_at` persistidos. |
| 2 | pgTAP + Vitest | supabase/tests/S5-07-interacciones-crm.sql, src/lib/validation/interactions.test.ts | `CHECK` de `kind` en BD (`throws_ok`); Zod rechaza `kind` inválido y `note` vacío. |
| 3 | pgTAP | supabase/tests/S5-07-interacciones-crm.sql | Owner de tenant B no ve ni inserta interacción sobre cliente de tenant A (`42501`/0 filas). |
| 4 | pgTAP | supabase/tests/S5-07-interacciones-crm.sql | Orden `occurred_at desc` recuperado correctamente vía `SELECT`. |
| 5 | pgTAP | supabase/tests/S5-07-interacciones-crm.sql | `UPDATE`/`DELETE` sobre una interacción existente fallan con `42501` para cualquier rol. |

## Historial
- 2026-07-20 · creada (draft)
- 2026-07-20 · aprobada por el humano (draft → approved)
- 2026-07-20 · implementada con TDD (approved → implemented), movida a `specs/done/`
