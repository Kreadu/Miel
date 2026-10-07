---
id: S26-03
titulo: PDF de la orden de compra y envío por WhatsApp
estado: implemented
depende_de: [S26-01, S26-02]
---

# S26-03 — PDF de la orden de compra

## Contexto y valor
Tercera parte de E26. El dueño quiere mandarle al proveedor un documento formal, con el logo y
los datos de la empresa, el detalle y quién pidió, aprobó y envió la orden. Así cada persona
queda como responsable. Hoy la orden solo existe dentro de Miel.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **B1 · "Enviada por"** es quien marca la orden como ordenada, o quien la crea con "Crear y
  ordenar". Se guarda su nombre (`ordered_by_name`). La fecha es `issued_at`, que ya existe. Las
  órdenes ordenadas antes de esta historia muestran "—" en esa firma.
- **B2 · Quién descarga:** solo dueño y admin, porque el PDF lleva costos y la matriz no deja que
  un operativo los vea. Se puede descargar en cualquier estado excepto cancelada; si la orden está
  pendiente de aprobación, el PDF dice "BORRADOR — sin aprobar".
- **B3 · WhatsApp:** en el celular, el botón comparte el PDF como archivo (Web Share API) y uno
  elige WhatsApp. En el computador, descarga el PDF y abre el chat del proveedor
  (`wa.me/<teléfono>`) con un mensaje que trae el número y el total. El archivo se adjunta a mano,
  porque WhatsApp Web no deja adjuntar desde un enlace. Los teléfonos de 10 dígitos que empiezan
  con 3 se toman como celulares de Colombia (+57). Si el proveedor no tiene teléfono, se abre
  WhatsApp sin destinatario.
- **B4 · Logo:** el PDF admite JPG y PNG. Si el logo es WEBP (S26-01 lo permite), el PDF sale con el
  nombre de la empresa en lugar del logo.
- **B5 · Dependencia nueva:** `@react-pdf/renderer` (decidido en el plan E26), con ADR-043.

## Alcance
- **Ruta** `GET /compras/ordenes/[id]/pdf` (route handler). Devuelve
  `application/pdf` con el nombre `OC-0001.pdf`. Dueño o admin de la empresa activa; si no, 404.
- **Contenido:** logo (o nombre), empresa (nombre, NIT, dirección, ciudad, teléfono, correo),
  "Orden de compra OC-0001" y fecha, proveedor (nombre, NIT, teléfono, correo, dirección),
  tabla (SKU, producto, cantidad, costo unitario, IVA %, total por línea), subtotal, IVA, total,
  nota y las tres firmas: pedida, aprobada y enviada por, con nombre y fecha.
- **Botones en la fila de la orden:** "PDF" (descarga) y "WhatsApp" (B3).
- **BD:** columna `purchases.ordered_by_name`, que llenan `mark_purchase_ordered` y
  `create_purchase` con `p_status='ordered'`.
- Textos del PDF y de los botones en es/en/fr, según el idioma del usuario.

## NO-alcance (explícito)
- Correo (S26-04), guardar el PDF en almacenamiento, plantillas personalizables, PDF de ventas.

## Criterios de aceptación
1. **Dado** un admin con una orden aprobada **cuando** pulsa "PDF" **entonces** descarga
   `OC-000N.pdf` con los datos de la empresa, del proveedor, el detalle, los totales y las firmas
   que tenga la orden.
2. **Dado** un operativo, un usuario de otra empresa o una orden cancelada **cuando** pide la ruta
   del PDF **entonces** recibe 404, sin revelar que la orden existe.
3. **Dado** una orden pendiente de aprobación **entonces** su PDF lleva la marca "BORRADOR — sin
   aprobar".
4. **Dado** que alguien marca una orden como ordenada **entonces** su nombre queda en "Enviada
   por". Sin "Tu nombre" no puede marcarla (`display_name_required`).
5. **Dado** el celular (375px) **cuando** pulsa "WhatsApp" **entonces** se abre el menú de
   compartir con el PDF adjunto. En el computador se descarga el PDF y se abre el chat con el
   mensaje. Los botones caben en la fila sin generar scroll horizontal en la página.

## Modelo de datos y migraciones
Migración `20261007130000_orden-enviada-por.sql`: `alter table purchases add column ordered_by_name text;` y
nuevas versiones de `mark_purchase_ordered` y `create_purchase` (las de S26-02 + la firma).

## Políticas RLS requeridas
Sin cambios. La ruta lee con la sesión del usuario (RLS) y además exige rol dueño o admin.

## Funciones RPC e invariantes
- `mark_purchase_ordered`: lo de S26-02 más `ordered_by_name = my_display_name(...)`.
- `create_purchase`: si `p_status='ordered'`, también firma `ordered_by_name`.

## Casos borde
- Orden de otra empresa, id que no es UUID u orden cancelada → 404.
- Empresa sin logo o con logo WEBP → nombre de la empresa en texto (B4). Si el logo no se puede
  descargar → el PDF sale igual, sin logo.
- Proveedor sin NIT, teléfono o dirección → esos renglones no aparecen.
- Navegador sin Web Share con archivos → se usa el camino del computador (B3).

## Consideraciones de seguridad
- El id de la ruta se valida con Zod (`z.uuid()`). Sin acceso → `notFound()`, nunca 403.
- Los datos de tenants y proveedores van al PDF como texto, nunca como instrucciones. El logo
  solo se descarga desde la URL del bucket `company-logos` del propio proyecto (se valida el
  origen), así que la ruta no hace pedidos a URLs arbitrarias (SSRF).
- El número de WhatsApp se arma solo con dígitos; el mensaje va con `encodeURIComponent`.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1,3 | Vitest | src/lib/purchases/pdf-data.test.ts | armado de los datos del documento (firmas, totales, marca de borrador, renglones vacíos) |
| 1 | Vitest | src/lib/purchases/purchase-pdf.test.tsx | `renderToBuffer` produce un PDF válido (`%PDF`) |
| 5 | Vitest | src/lib/purchases/whatsapp.test.ts | teléfono → wa.me (+57, solo dígitos, sin teléfono) y texto del mensaje |
| 2 | Vitest | src/app/(app)/compras/ordenes/[id]/pdf/route.test.ts | 404 para uuid inválido, operativo, sin orden o cancelada |
| 4 | pgTAP | supabase/tests/S26-03-orden-enviada-por.sql | `ordered_by_name` al marcar y al crear ordenada; sin nombre no marca |

El humano corre el pgTAP y prueba el PDF en el navegador y en el celular (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos B1–B5 pendientes de confirmar.
- 2026-10-07 · aprobada por el humano con B1–B5 tal cual.
- 2026-10-07 · implementada. Ruta `src/app/(app)/compras/ordenes/[id]/pdf/route.ts`; lógica en
  `src/lib/purchases/{pdf-data,pdf-logo,purchase-pdf,whatsapp}.ts`; botones en
  `purchase-share.tsx`. ADR-043. pgTAP 8/8 contra PGlite con stubs (y S26-02 31/31, S3-02,
  S3-04 siguen verdes); **falta `supabase test db`** y probar el PDF y el envío por WhatsApp en
  el navegador y en el celular.
