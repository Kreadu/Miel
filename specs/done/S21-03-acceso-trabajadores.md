---
id: S21-03
titulo: Acceso de trabajadores — correo con categoría y "modo tienda" con código de 4 dígitos
estado: implemented
depende_de: [S21-02, S1-05]
---

# S21-03 — Acceso de trabajadores

## Contexto y valor

Pedido del humano 2026-09-29: cada trabajador entra con usuario y código de 4 dígitos y ve solo lo
de su categoría; unificar rol y categoría; dar el acceso desde la ficha del trabajador; miembros e
invitaciones en una pestaña "Usuarios con correo". Mecanismo elegido por el humano: correo (desde
cualquier lugar) + modo tienda con código (en el equipo de la tienda). Ver ADR-037.

## Alcance

- Migración `20260929203354_acceso-trabajadores.sql`: `memberships.category_id`,
  `invitations.category_id/worker_id`, `workers.username/pin_hash/user_id` (grants por columna: el
  hash no se lee ni escribe por la API), `worker_login_attempts`, RPCs `set_worker_pin`,
  `clear_worker_pin`, `verify_worker_pin` (bloqueo 5/15 min, código incorrecto = sin filas para
  que el intento quede registrado), `active_worker_modules`, `accept_invitation` con categoría y
  enlace al trabajador, trigger que sincroniza la categoría.
- `src/lib/tenant/store-session.ts` (cookie firmada), `access.ts` (`resolveAccess`, `canSeeHref`),
  `getActiveTenant` (rol efectivo, módulos, modo tienda, trabajador; con `cache`), `requireModule`
  en los layouts de Vender/Inventario/Comprar/Gastos/RRHH, menú filtrado.
- Acciones `src/actions/store.ts` (activar, identificar, cambiar trabajador, salir con contraseña)
  y `setWorkerPinAccess`/`clearWorkerPinAccess`; invitaciones con campo "Acceso".
- Pantallas: `/trabajador` (usuario + código), `/trabajador/salir`, controles del modo tienda en el
  menú, "Acceso a Miel" en la ficha del trabajador (código o invitación por correo),
  `/equipo/usuarios` (miembros e invitaciones), nota en el login.
- Categorías: solo Vender, Inventario y Comprar (Gastos y RRHH son de administradores por RLS).

## Criterios de aceptación

1. Invitar por correo con Administrador, Cuenta de la tienda o una categoría.
2. Una cuenta de tienda activa el modo tienda; sin trabajador identificado todo lleva a
   `/trabajador`; con código correcto el trabajador ve solo sus módulos.
3. 5 códigos fallidos en 15 minutos bloquean ese usuario; los intentos quedan registrados.
4. Salir del modo tienda pide la contraseña de la cuenta.
5. Un módulo fuera de la categoría responde 404 aunque se escriba la dirección.

## Tests

- pgTAP `supabase/tests/S21-03-acceso-trabajadores.sql`. Vitest `src/lib/tenant/store-session.test.ts`,
  `access.test.ts`, `nav-visibility.test.ts`, `src/actions/store.test.ts`, `workers.test.ts`,
  `invitations.test.ts`, `src/lib/validation/invitations.test.ts`.
