---
id: S26-08
titulo: El nombre con que se firman las órdenes sale de RRHH (sin "Mi perfil")
estado: implemented
depende_de: [S26-01, S26-02, S21-03]
---

# S26-08 — El nombre sale de RRHH → Trabajadores

## Contexto y valor
Hoy el nombre con que se firman las órdenes de compra se escribe en "Mi perfil", y el mismo
nombre ya está en RRHH → Trabajadores. Es información repetida y "Mi perfil" es difícil de
encontrar. El humano pidió el 2026-10-08 que el nombre venga solo de RRHH.

## Decisiones (aprobadas por el humano el 2026-10-08)
- **N1 · Fuente:** quien pide, aprueba o envía una orden firma con el `full_name` del trabajador
  activo de RRHH conectado a su cuenta (`workers.user_id`). Sin trabajador conectado:
  `display_name_required`, con el mensaje "Créate en RRHH → Trabajadores con tu correo" y un enlace
  ahí.
- **N2 · Conexión:**
  - por invitación, como ya funciona (S21-03);
  - por el mismo correo: un trabajador sin cuenta conectada, cuyo correo (sin distinguir
    mayúsculas) es el de una cuenta de esa empresa, se conecta al guardarlo, y también con los
    datos existentes al aplicar la migración.
- **N3 · Una sola fuente, sin escribir dos veces:** `memberships.display_name` deja de escribirse
  a mano y pasa a ser copia automática del nombre de RRHH (trigger), para Caja, RRHH → Usuarios y
  el pie del menú. Al migrar, las cuentas sin trabajador quedan sin nombre.
- **N4 · Fuera "Mi perfil":** se borran la página `/perfil`, su formulario, la acción, el esquema
  y la RPC `set_my_display_name`. El pie del menú muestra el nombre (o el correo) sin enlace.
- **N5 · Las órdenes ya firmadas** conservan el nombre guardado.

## Criterios de aceptación
1. **Dado** una dueña sin trabajador en RRHH **cuando** crea una orden ordenada **entonces**
   recibe `display_name_required`, aunque tenga un nombre viejo de "Mi perfil".
2. **Dado** que crea en RRHH un trabajador con su mismo correo (en otras mayúsculas) **entonces**
   el trabajador queda conectado a su cuenta, su membresía muestra ese nombre y la orden queda
   firmada con él.
3. **Dado** que se corrige el nombre en RRHH **entonces** la membresía se actualiza; las órdenes
   ya firmadas no cambian.
4. **Dado** un trabajador con ese correo en otra empresa **entonces** no se conecta con la cuenta
   en esta.
5. No hay enlace ni página "Mi perfil". El error de firma lleva a RRHH → Trabajadores.

## Plan de tests
| Criterio | Tipo | Archivo |
|---|---|---|
| 1–4 | pgTAP | supabase/tests/S26-08-nombre-desde-rrhh.sql |
| 5 | build + revisión | — |

## Historial
- 2026-10-08 · creada y approved por el humano ("sí apruébalo así").
- 2026-10-08 · implemented. Trigger `workers_sync_account`; `my_display_name` lee de `workers`. Se
  adaptaron los fixtures de S3-02, S3-04, S26-02 y S26-03 (nombre desde RRHH) y en S26-01 se
  quitaron los tests de "Tu nombre". pgTAP solo en PGlite.
