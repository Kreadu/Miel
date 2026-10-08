---
id: S26-12
titulo: Conectar mi ficha de RRHH con mi cuenta (sin invitarme a mí mismo)
estado: implemented
depende_de: [S26-08]
---

# S26-12 — Conectar mi ficha con mi cuenta

## Contexto
El humano escribió su propio correo en "Acceso con correo" de su ficha (3 veces): eso crea
invitaciones a sí mismo y no conecta la ficha, así que la orden de compra no se puede firmar
(S26-08). Hay dos campos de correo en la ficha y confunden.

## Decisión (aprobada por el humano el 2026-10-08: "revisa porque no resulta")
- **Mi correo en "Acceso con correo":** si quien invita escribe **su propio** correo en
  "Acceso con correo" de una ficha, Miel no invita: conecta esa ficha a su cuenta con la RPC
  `link_worker_to_me`.
- **Qué hace `link_worker_to_me`:**
  - solo la usa el dueño o un administrador de la empresa de la ficha;
  - la ficha no puede estar conectada a otra cuenta, y la cuenta no puede tener ya otra ficha en
    esa empresa;
  - si la ficha no tiene correo, se completa con el de la cuenta;
  - borra las invitaciones pendientes a ese correo en esa empresa;
  - el nombre se copia por el trigger de S26-08.
- **Pantalla:** "Listo: esta ficha quedó conectada a tu cuenta."

## Criterios
1. La dueña conecta su ficha: `user_id` queda en su cuenta, la membresía toma el nombre y sus
   invitaciones pendientes se borran.
2. No se conecta:
   - una ficha ya conectada a otra cuenta (`worker_linked`);
   - una segunda ficha para la misma cuenta (`account_already_linked`);
   - una ficha de otra empresa, ni con rol miembro (`permission_denied`).

## Tests
- pgTAP: `supabase/tests/S26-12-conectar-mi-ficha.sql`.
- Vitest: `createInvitation` con el propio correo.

## Historial
- 2026-10-08 · creada y approved.
- 2026-10-08 · implemented. Migración `20261008190000_conectar-mi-ficha.sql`. pgTAP 7/7, solo en PGlite.
