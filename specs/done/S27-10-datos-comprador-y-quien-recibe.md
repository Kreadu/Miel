---
id: S27-10
titulo: Carrito — nombres y apellidos, documento, celular con código de país y quién recibe o recoge
estado: implemented
depende_de: [S27-02, S27-04]
---

# S27-10 — Datos del comprador y de quien recibe o recoge

## Decisiones (aprobadas por el humano el 2026-10-08, "con el diseño que hay ahora")
- **Comprador:**
  - Nombres y Apellidos en campos separados; se guardan juntos en `customers.name`.
  - Documento: tipo (Cédula de ciudadanía, Cédula de extranjería, Pasaporte = `other`, NIT) y
    número; va a `customers.doc_type/doc_number`.
  - Celular con selector de país (Colombia +57 por defecto, América, España y EE. UU.); se guarda
    como lo escribió, "+57 3105550001".
  - Correo opcional.
  - Un cliente que ya existía se reconoce igual (`normalize_phone` quita el +57) y se le completa
    el documento si no lo tenía.
- **Quién recibe o recoge:**
  - Casilla "Lo recibe quien compra" o "Lo recoge quien compra", marcada por defecto.
  - Si se desmarca: nombre completo, documento y celular (con código) de quien recibe o recoge.
  - Se guarda en `sales.receiver_name/receiver_doc/receiver_phone`.
  - Se ve en Vender → Pedidos y va en el WhatsApp a la tienda.
  - El seguimiento público no lo muestra, por privacidad (S27-04, H3).
- **Diseño:** el mismo de la página del carrito; solo se agregan esos campos.

## Tests
- pgTAP: `supabase/tests/S27-10-datos-comprador-y-quien-recibe.sql`. Se ajustó S27-02: el
  teléfono se guarda tal como se escribió.
- Vitest: `src/actions/store-order.test.ts` y `src/lib/store/phone.test.ts`.

## Historial
- 2026-10-08 · approved e implemented. Migración `20261008230000_datos-comprador-y-quien-recibe.sql`.
  pgTAP solo en PGlite. Sin revisión visual.
