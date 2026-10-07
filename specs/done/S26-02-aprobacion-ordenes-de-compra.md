---
id: S26-02
titulo: Aprobadores de órdenes de compra, número OC y "Aprobar"
estado: implemented
depende_de: [S26-01]
---

# S26-02 — Aprobación de órdenes de compra

## Contexto y valor
Segunda parte de E26 (plan aprobado 2026-09-30). Hoy cualquier dueño/admin crea una orden y la
marca "ordenada" sin que nadie la autorice, y la orden no tiene número. El dueño quiere elegir
quién aprueba, que cada orden tenga número (OC-0001) y que quede quién la pidió y quién la aprobó,
con nombre y fecha, para el PDF de S26-03.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **A1 · Sin "Rechazar"**: el aprobador que no está de acuerdo usa el "Cancelar" que ya existe.
  Rechazar con motivo queda para después si hace falta.
- **A2 · Auto-aprobación**: si quien pide la orden puede aprobar (el dueño o un aprobador), la orden
  nace aprobada con su nombre en las dos firmas. Así, una empresa con un solo dueño no gana pasos.
- **A3 · Órdenes viejas**: se numeran por fecha de creación (OC-0001 la más antigua de cada
  empresa). Las ya ordenadas o recibidas siguen igual (recibir y pagar no piden aprobación). Los
  borradores viejos quedan como "Pendiente de aprobación".
- **A4 · Quién pide**: igual que hoy, solo dueño/admin crean órdenes. Que un operativo o un
  trabajador en modo tienda pida (plan E26) requiere cambiar la matriz de permisos y ocultarle los
  costos, así que se separa en la historia **S26-06** (nueva en el BACKLOG).
- **A5 · Editar después de aprobar**: editar una orden aprobada (en borrador u ordenada) le quita la
  aprobación y la devuelve a "Pendiente de aprobación" (estado `draft`). Si la edita un aprobador,
  vuelve a quedar aprobada sola (A2).

## Alcance
- **Aprobadores**: en RRHH → Usuarios, el dueño marca o desmarca "Aprueba órdenes de compra" en
  cada admin. El dueño aprueba siempre y no se puede desmarcar. Los operativos no pueden ser
  aprobadores, y las cuentas de tienda son operativas.
- **Número**: consecutivo por empresa, visible como `OC-0001` en la lista, el historial y la cuenta
  del proveedor.
- **Estados que ve el usuario** (sin valores nuevos en `status`): `draft` sin aprobar →
  "Pendiente de aprobación"; `draft` aprobada → "Aprobada"; `ordered`, `received` y `cancelled`
  como hoy.
- **Botón "Aprobar"** (solo aprobadores, solo en pendientes). "Marcar ordenada" y "Crear y
  ordenar" solo funcionan si la orden está aprobada.
- **Firmas en la orden**: pedida por + fecha y aprobada por + fecha. Guardan el "Tu nombre" de
  S26-01 en el momento en que se firma; si después la persona cambia su nombre, la orden no cambia.
- Textos es/en/fr. ADR-042 y una línea nueva en la matriz de `permisos-roles.md`.

## NO-alcance (explícito)
- PDF y WhatsApp (S26-03), correo (S26-04), rechazo con motivo (A1), pedidos de operativos o de
  modo tienda (A4 → S26-06), avisos al aprobador.

## Criterios de aceptación
1. **Dado** el dueño en RRHH → Usuarios **cuando** marca a un admin como aprobador **entonces**
   ese admin ve "Aprobar" en las órdenes pendientes. Un admin no puede marcar a nadie, y un
   operativo no puede ser marcado (la RPC lo rechaza).
2. **Dado** un admin que no aprueba **cuando** crea una orden **entonces** queda "OC-000N ·
   Pendiente de aprobación · pedida por <su nombre> <fecha>", sin "Marcar ordenada". "Crear y
   ordenar" y `mark_purchase_ordered` sobre ella fallan con `approval_required`.
3. **Dado** una orden pendiente **cuando** un aprobador pulsa "Aprobar" **entonces** queda
   "Aprobada · aprobada por <nombre> <fecha>" y ya se puede marcar ordenada. Si la crea un
   aprobador, nace aprobada (A2). Si se edita después de aprobada, vuelve a pendiente (A5).
4. **Dado** quien no tiene "Tu nombre" **cuando** crea o aprueba **entonces** ve un error que lo
   lleva a "Mi perfil" (`display_name_required`) y la orden no se crea ni se aprueba.
5. **Dado** órdenes anteriores a la migración **entonces** tienen número por fecha de creación, y
   las ordenadas se pueden recibir, pagar y cancelar como antes. En 375px la fila de la orden
   (número, estado, firmas, botones) no genera scroll horizontal.

## Modelo de datos y migraciones
Migración `20261007120000_aprobacion-ordenes-compra.sql`, que va **después** de la de S26-01:
```sql
alter table memberships add column can_approve_purchases boolean not null default false;
alter table purchases
  add column number integer,
  add column requested_by_name text, add column requested_at timestamptz,
  add column approved_by uuid references auth.users(id),
  add column approved_by_name text, add column approved_at timestamptz;
create table purchase_counters (tenant_id uuid primary key references tenants, last_no integer not null);
-- backfill: number = row_number() over (partition by tenant_id order by created_at, id);
-- purchase_counters = max(number) por tenant; luego number not null + unique (tenant_id, number).
```

## Políticas RLS requeridas
- `purchase_counters`: RLS activa, select por tenant (`user_tenant_ids()`), sin escritura (solo
  RPC). Mismo patrón que `sale_counters`.
- `purchases` y `memberships`: las políticas no cambian. Las columnas nuevas se escriben solo
  desde las RPC.

## Funciones RPC e invariantes
- `user_can_approve_purchases(p_tenant_id) → boolean`: verdadero si es dueño, o admin con
  `can_approve_purchases`.
- `set_purchase_approver(p_membership_id, p_value)`: solo el dueño de esa empresa. La membresía
  destino tiene que ser `admin`.
- `create_purchase`: asigna el número con upsert en `purchase_counters`, firma "pedida por" y,
  si quien la crea aprueba, también "aprobada por". `p_status='ordered'` sin poder aprobar →
  `approval_required`. Sin nombre → `display_name_required`.
- `approve_purchase(p_purchase_id)`: aprobador, orden `draft` no aprobada → firma la aprobación.
- `mark_purchase_ordered`: además de `draft`, exige `approved_at is not null`.
- `update_purchase`: limpia la aprobación y pasa `ordered` a `draft` (con `issued_at` en null).
  Si quien edita aprueba, vuelve a firmar (A5).
- `cancel_purchase` y `receive_purchase`: sin cambios.
- Invariante: ninguna orden llega a `ordered` por estas RPC sin `approved_at`. Las anteriores a la
  migración quedan exentas (A3).

## Casos borde
- Dos órdenes creadas a la vez: el upsert del contador serializa, así que no hay números repetidos
  y el índice único lo garantiza.
- Aprobar dos veces o aprobar una orden cancelada u ordenada → `purchase_not_pending`.
- Le quitan el rol admin a un aprobador: deja de aprobar, aunque su marca quede guardada.
- Desmarcar al dueño o marcar a un operativo → `approver_invalid`.
- Orden ordenada con pagos al proveedor ligados → no se edita (`purchase_has_payments`): volver a
  borrador la sacaría de la deuda y el pago quedaría suelto en la cuenta del proveedor.

## Consideraciones de seguridad
- Acciones nuevas (`approvePurchase`, `setPurchaseApprover`) con Zod (`z.uuid()`, booleano) y
  errores mapeados a claves; nunca se muestra el mensaje interno.
- La autorización vive en las RPC (security definer con revisión explícita de rol). La UI solo
  oculta botones.
- Los nombres de las firmas salen de `memberships.display_name` dentro de la RPC, nunca del cliente.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S26-02-aprobacion-ordenes.sql | solo el dueño marca; destino admin; operativo rechazado; aislamiento de `purchase_counters` |
| 2,3,4 | pgTAP | (mismo) | número consecutivo; pendiente vs auto-aprobada; `approval_required`; aprobar; editar quita la aprobación; `display_name_required` |
| 5 | pgTAP | (mismo) | backfill de números; una orden vieja ordenada se recibe sin aprobación |
| 1–4 | Vitest | src/actions/purchases.test.ts | validación Zod y mapeo de errores nuevos |
| 2,3 | Vitest | src/lib/purchases/approval.test.ts | estado visible derivado (pendiente/aprobada) y formato OC-0001 |

Los pgTAP y la migración los corre y aplica el humano: en este entorno no hay Docker ni CLI de
Supabase (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos A1–A5 pendientes de confirmar.
- 2026-10-07 · aprobada por el humano con A1–A5 tal cual.
- 2026-10-07 · implementada. El número lo asigna un trigger al insertar (así también lo reciben las
  inserciones directas de los tests); `my_display_name` es un helper interno, sin grant. Los
  fixtures de S3-02 y S3-04 y el seed demo ganan `display_name`. En RRHH → Usuarios se ve el nombre
  de cada miembro y se listan solo los de la empresa activa. pgTAP: 31/31 (con el ajuste de abajo) contra PGlite con stubs
  de auth y un shim de pgTAP (S3-02 18/18, S3-04 13/13); **falta correrlo en `supabase test db`**.
- 2026-10-07 · ajuste tras revisión: `update_purchase` rechaza editar una orden con pagos ligados
  (`purchase_has_payments`), porque A5 la devolvería a borrador fuera de las cuentas por pagar.
