---
id: S1-03
titulo: Onboarding — crear empresa (tenant + owner)
estado: implemented
depende_de: [S1-02]
---

# S1-03 — Onboarding: crear empresa

## Contexto y valor
Un usuario recién registrado no pertenece a ningún tenant y no puede usar nada. Esta
historia le permite crear su empresa y quedar como `owner`, de forma atómica: es el único
camino para nacer un tenant en el sistema.

## Alcance
- Página `/onboarding` (reemplaza el stub de S1-02): **sin membership** muestra el formulario
  nombre de empresa + NIT opcional; **con ≥1 membership** muestra estado provisional "empresa
  creada" con acciones "crear otra empresa" (vuelve al formulario) y logout — destino
  provisional hasta que S1-04 introduzca la app real y el tenant activo.
- RPC `create_tenant_with_owner(p_name text, p_nit text default null) returns uuid` —
  atómica, `security definer` (justificado en ADR-018: el usuario aún no tiene membership y
  RLS le impediría el insert). Crea el tenant y la membership `owner` del usuario autenticado.
  `grant execute on function public.create_tenant_with_owner(text, text) to authenticated`
  (defensa en profundidad, coherente con el patrón de GRANT explícito de S1-01).
- Server Action con Zod que llama la RPC y redirige a `/onboarding`.
- Usuario autenticado CON tenant que visita `/onboarding`: puede crear otra empresa
  (multi-empresa por usuario está permitido) o volver a la app.

## NO-alcance (explícito)
- Selector de empresa y layout (S1-04). Invitaciones (S1-05).
- Edición/eliminación de tenant (la matriz de permisos la reserva; historia futura).
- Bodega por defecto u otros datos semilla del tenant (los crea cada módulo en su historia).

## Criterios de aceptación
1. **Dado** un usuario autenticado sin membership **cuando** envía nombre válido **entonces**
   existen un tenant nuevo y su membership `owner`, y es redirigido a `/onboarding`, que ahora
   detecta la membership y muestra estado "empresa creada" en vez del formulario (destino
   provisional: la app real y el tenant activo llegan en S1-04, que reemplaza este destino).
2. **Dado** que el insert de la membership falla **cuando** corre la RPC **entonces** el
   tenant tampoco queda creado (atomicidad probada en pgTAP: ningún tenant sin owner).
3. **Dado** un usuario autenticado **cuando** llama la RPC **entonces** la membership creada
   es para SÍ MISMO y con rol `owner` — no puede crear memberships para terceros ni en
   tenants ajenos por esta vía (no-escalada probada en pgTAP).
4. **Dado** un nombre vacío o solo espacios **cuando** se envía **entonces** la RPC rechaza
   con `raise exception` y la action responde `{ ok: false, error }` (y Zod lo frena antes
   en el borde).
5. **Dado** un usuario anónimo **cuando** intenta llamar la RPC **entonces** es rechazado
   (`auth.uid()` nulo → excepción).

## Modelo de datos y migraciones
Sin tablas nuevas (usa `tenants` y `memberships` de S1-01). Migración solo con la función
`create_tenant_with_owner`.

## Políticas RLS requeridas
Las de S1-01 sin cambios. La RPC es `security definer` con `set search_path = public`,
valida `auth.uid() is not null` y solo inserta `(auth.uid(), rol 'owner')` — nunca recibe
user_id ni role por parámetro. Ver matriz `docs/arch/permisos-roles.md`.

## Funciones RPC e invariantes
`create_tenant_with_owner(p_name, p_nit default null) returns uuid` (id del tenant):
1. Usuario autenticado (`auth.uid() is not null`), si no → excepción.
2. `p_name` no vacío tras `trim`, si no → excepción.
3. Tenant + membership owner en la misma transacción: todo o nada.
4. La membership es siempre `(auth.uid(), tenant_nuevo, 'owner')` — parámetros no influyen.

## Casos borde
- Mismo usuario crea dos empresas → permitido; dos memberships owner independientes.
- Nombre duplicado entre tenants distintos → permitido (no hay unicidad global de nombre).
- NIT con formato libre → se guarda como texto (validación fiscal es Fase 2/DIAN).
- Llamada concurrente doble (doble click) → dos tenants; la UI previene con estado pending
  (aceptado en MVP; sin constraint de idempotencia).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- **Validación en el boundary**: Server Action con Zod antes de llamar la RPC (criterio 4);
  la RPC pasa solo `p_name`/`p_nit` validados — sin spread del input.
- **No-escalada**: la RPC `security definer` jamás recibe user_id ni role por parámetro
  (invariante 4, probado en pgTAP) — es el control central de esta historia.
- **Errores genéricos**: las excepciones de la RPC se mapean a mensajes en español; el
  detalle de Postgres no llega al cliente.
- **Redirect post-creación**: a ruta interna fija de la app (sin parámetros del cliente).

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S1-03-onboarding.sql | caso feliz: tenant + membership owner creados |
| 2 | pgTAP | supabase/tests/S1-03-onboarding.sql | atomicidad: con inputs válidos la membership no puede fallar, así que la invariante "ningún tenant sin owner" se prueba (a) por las rutas de excepción (nombre vacío/anónimo) que no dejan tenant nuevo, y (b) chequeo estructural post-caso-feliz de que ningún tenant carece de membership owner |
| 3, 5 | pgTAP | supabase/tests/S1-03-onboarding.sql | no-escalada y rechazo a anónimo |
| 4 | pgTAP + Vitest | S1-03-onboarding.sql · src/lib/validation/onboarding.test.ts | nombre vacío rechazado en RPC y en Zod |

## Historial
- 2026-07-19 · creada (draft) en la auditoría integral pre-desarrollo — pendiente de aprobación humana.
- 2026-07-19 · ADR-020: sección "Consideraciones de seguridad" agregada (retrofit del
  estándar de seguridad).
- 2026-07-19 · revisión pre-aprobación: se cerró el hueco del destino post-creación (el grupo
  `(app)` y el tenant activo son S1-04, aún no existen) — se fija `/onboarding` como destino
  provisional con estado "empresa creada"; se añadió `grant execute` explícito a la RPC; se
  precisó el enfoque de prueba de atomicidad del criterio 2. Aprobada por el humano
  (`draft` → `approved`).
- 2026-07-19 · implementada con TDD: RPC `create_tenant_with_owner`, Zod, Server Action y
  reemplazo del stub de `/onboarding` por el flujo real. `supabase test db` (17/17) y Vitest
  (21/21) en verde; verificación E2E con navegador real vía script Playwright desechable en
  el scratchpad (no commiteado). Movida a `specs/done/` (`approved` → `implemented`).
- 2026-07-24 · S11-01 (ADR-026) supersede el criterio de multi-empresa: un usuario ya owner no
  puede crear una segunda empresa; C6 de `supabase/tests/S1-03-onboarding.sql` actualizado a la
  regla nueva. Ver specs/done/S11-01-limite-un-owner.md.
