---
id: S5-09
titulo: Apertura y cierre de caja con arqueo
estado: implemented         # draft → approved → implemented
depende_de: [S5-03]
---

# S5-09 — Apertura y cierre de caja con arqueo

## Contexto y valor
El POS (ADR-017) exige control de efectivo por turno: quién abrió caja, con cuánto, y si al
cierre el efectivo contado coincide con lo esperado según los cobros del turno. Sin esto,
`register_pos_sale` (S5-10) no tiene a qué sesión ligar la venta ni cómo detectar faltantes/
sobrantes de caja. Es la segunda pieza del POS, después de descuentos/consecutivo (S5-08) y
antes de la venta rápida (S5-10).

## Alcance
- Tabla `cash_sessions` (una sesión abierta por usuario a la vez).
- RPC `open_cash_session(p_opening_amount)` — abre sesión para el usuario autenticado.
- RPC `close_cash_session(p_counted_amount, p_session_id, p_note)` — cierra una sesión,
  calcula `expected_amount` en BD (base + cobros en efectivo del turno) y registra
  `difference`. `p_session_id` es opcional: si se omite, cierra la sesión abierta del propio
  usuario; owner/admin pueden pasar el id de la sesión de otro usuario del tenant.
- Vista `cash_session_summary`: por sesión, ventas del turno, cobros por método, esperado vs
  contado, diferencia.
- Permisos: member ve y opera únicamente su propia sesión; owner/admin ven y pueden cerrar
  cualquier sesión del tenant (matriz `permisos-roles.md`).
- UI mínima: página `/ventas/caja` — estado de la sesión propia (abierta/cerrada), formulario
  de apertura (monto base) si no hay sesión abierta, formulario de cierre (monto contado) si
  la hay, y tabla de resumen (`cash_session_summary`) de sesiones visibles según rol.

## NO-alcance (explícito)
- `register_pos_sale` y la pantalla de venta rápida (S5-10): esta historia no crea ventas ni
  liga `sales.cash_session_id`, solo prepara la sesión para que S5-10 la use.
- Cobros ligados a `cash_session_id` en `customer_payments` fuera del cálculo de esperado:
  `register_customer_payment` (S5-04) no cambia su firma en esta historia; el esperado de
  `close_cash_session` se calcula sobre lo que exista en `customer_payments.cash_session_id`
  para esa sesión, aunque hoy ningún flujo lo pueble todavía (quedará poblado desde S5-10).
- Múltiples cajas físicas concurrentes por usuario, historial de arqueos con ajustes
  posteriores, o reapertura de una sesión cerrada — Fase 2.
- Reportes de caja en la página Finanzas (S7-03).

## Criterios de aceptación
1. **Dado** un usuario sin sesión de caja abierta **cuando** invoca
   `open_cash_session(opening_amount)` **entonces** se crea una fila `status='open'` con
   `opened_by = auth.uid()`, `opening_amount` persistido y `opened_at = now()`.
2. **Dado** un usuario con una sesión ya abierta **cuando** invoca `open_cash_session` de
   nuevo **entonces** falla con `cash_session_already_open` y no se crea una segunda fila.
3. **Dado** una sesión abierta con cobros en efectivo (`customer_payments.method='cash'`)
   ligados a ella por `total_cash` **cuando** el dueño la cierra con
   `close_cash_session(counted_amount)` **entonces** `expected_amount = opening_amount +
   total_cash`, `difference = counted_amount - expected_amount`, `status='closed'`,
   `closed_at` seteado.
4. **Dado** una sesión ya cerrada **cuando** se intenta cerrar de nuevo (mismo id o, sin id,
   la última cerrada) **entonces** falla con `cash_session_not_open` y no se modifica la fila.
5. **Dado** un usuario con rol `member` **cuando** intenta cerrar la sesión abierta de otro
   usuario del mismo tenant (pasando su `p_session_id`) **entonces** falla con
   `permission_denied`; **dado** un usuario `owner`/`admin` **cuando** hace lo mismo
   **entonces** la sesión se cierra correctamente.

## Modelo de datos y migraciones
Referencia: `docs/data-model.md` (E5), `docs/arch/diagrama-er.md`.

Migración nueva `supabase/migrations/<ts>_cash_sessions.sql`:

```sql
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(14,2) not null check (opening_amount >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  counted_amount numeric(14,2),
  expected_amount numeric(14,2),
  difference numeric(14,2),
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index cash_sessions_tenant_id_idx on public.cash_sessions (tenant_id);
create index cash_sessions_opened_by_idx on public.cash_sessions (opened_by);

-- Un usuario no puede tener dos sesiones abiertas: índice único parcial, red de seguridad
-- además de la validación explícita en open_cash_session.
create unique index cash_sessions_one_open_per_user
  on public.cash_sessions (tenant_id, opened_by)
  where status = 'open';
```

`sales.cash_session_id` ya existe (S5-02) sin FK — esta migración le agrega
`references public.cash_sessions(id) on delete restrict` ahora que la tabla existe.
`customer_payments.cash_session_id` (documentada en `data-model.md` pero no creada en S5-04)
se agrega en esta misma migración como columna nueva, nullable, con esa misma FK.

## Políticas RLS requeridas
- `cash_sessions`: RLS habilitada.
  - `cash_sessions_tenant_select`: `tenant_id in (select user_tenant_ids())` **y**
    (`opened_by = auth.uid()` **o** `user_is_tenant_admin(tenant_id)`) — member ve solo la
    suya, owner/admin ven todas (permisos-roles.md).
  - Sin política de insert/update/delete: toda escritura entra por `open_cash_session`/
    `close_cash_session` (`security definer`), mismo patrón "solo lectura + RPC".
  - `GRANT SELECT` a `authenticated, service_role`.

## Funciones RPC e invariantes
- `open_cash_session(p_opening_amount numeric)` returns uuid — invariantes: `opening_amount
  >= 0`; el usuario no tiene ya una sesión `open` en su tenant (`cash_session_already_open`);
  tenant derivado de la membresía del usuario (`user_tenant_ids()`, primer tenant si tiene
  varios — mismo supuesto que el resto del módulo de ventas, sin selector de tenant en el
  RPC).
- `close_cash_session(p_counted_amount numeric, p_session_id uuid default null, p_note text
  default null)` returns uuid — invariantes: `counted_amount >= 0`; resuelve la sesión
  objetivo (`p_session_id` o la sesión `open` del propio usuario si es null); la sesión debe
  existir, pertenecer al tenant del usuario y estar `status='open'`
  (`cash_session_not_open`/`cash_session_not_found`); si `p_session_id` pertenece a otro
  usuario, solo procede si `user_is_tenant_admin(tenant_id)` (`permission_denied`);
  `expected_amount` calculado en BD como `opening_amount + Σ customer_payments.amount` de esa
  sesión con `method='cash'`; `difference = counted_amount - expected_amount`; `status`,
  `closed_at`, `counted_amount`, `expected_amount`, `difference` actualizados atómicamente.

## Casos borde
- Sesión abierta sin ningún cobro en efectivo asociado: `expected_amount = opening_amount`,
  `difference = counted_amount - opening_amount`.
- `counted_amount` distinto de `expected_amount` (faltante o sobrante): válido, se persiste
  la diferencia (positiva o negativa) sin bloquear el cierre — el arqueo es informativo, no
  impide cerrar.
- Usuario sin membresía en ningún tenant: `open_cash_session` falla igual que el resto de
  RPCs del módulo (`user_tenant_ids()` vacío → `permission_denied` al no encontrar tenant).
- `close_cash_session` sin sesión abierta propia y sin `p_session_id`: `cash_session_not_open`.
- Dos aperturas concurrentes del mismo usuario (misma sesión HTTP dos veces): el índice único
  parcial `cash_sessions_one_open_per_user` rechaza la segunda inserción a nivel de fila
  aunque la validación explícita en el RPC no alcance a verla por carrera.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor: `openCashSessionSchema`/`closeCashSessionSchema` (Zod) validan forma
  en `src/actions/cash-sessions.ts` antes de invocar los RPCs; los RPCs revalidan invariantes
  de negocio (defensa en profundidad).
- Errores internos no llegan al cliente: `mapCashSessionError` traduce cada código
  (`cash_session_already_open`, `cash_session_not_open`, `cash_session_not_found`,
  `permission_denied`) a mensaje genérico en español.
- Autorización real en RLS + `security definer` con chequeo explícito de
  `user_is_tenant_admin`, no en la UI: la UI oculta el selector de "cerrar otra sesión" a
  `member`, pero el RPC es quien la bloquea de verdad (criterio 5).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | `open_cash_session` crea fila `open` con datos correctos |
| 2 | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | segunda apertura del mismo usuario falla, no duplica fila |
| 3 | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | `close_cash_session` calcula `expected_amount`/`difference` correctos con cobros en efectivo previos |
| 4 | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | cerrar una sesión ya cerrada falla, no la modifica |
| 5 | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | member no cierra sesión ajena; owner/admin sí |
| — | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | aislamiento de tenant en `cash_sessions` y `cash_session_summary`; member no ve sesión ajena en SELECT |
| — | Vitest | src/lib/validation/cash-sessions.test.ts | `openCashSessionSchema`/`closeCashSessionSchema`: montos no negativos, coerción string→number |

## Historial
- 2026-07-20 · creada y aprobada en la misma sesión (draft → approved): alcance de UI mínima
  (`/ventas/caja`) y modelo de permisos (member solo su sesión; owner/admin todas y pueden
  cerrar la de otro) confirmados explícitamente con el humano vía `AskUserQuestion` antes de
  redactar.
- 2026-07-20 · implementada con TDD (approved → implemented): pgTAP (18 tests) y Vitest (8
  tests) escritos primero y verificados en rojo (`relation "public.cash_sessions" does not
  exist`, luego `function public.open_cash_session(integer) does not exist`); migración
  después, verde sin ajustes al diseño de los tests. Hallazgo real durante la implementación:
  `customer_payments.cash_session_id`, documentada en `data-model.md` desde S5-04, **nunca se
  creó** en esa historia — se agrega en esta migración (columna nueva nullable + FK), no era
  solo "agregar FK" como se asumió al redactar la spec. UI: página `/ventas/caja` (estado de
  sesión propia, formularios de apertura/cierre, tabla `cash_session_summary`) + enlace desde
  `/ventas`. Suite completa 278/278 pgTAP, 119/119 Vitest. `lint`/`tsc` limpios.
