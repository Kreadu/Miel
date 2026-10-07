---
id: S27-03
titulo: Tienda en línea — pago manual (instrucciones y comprobante)
estado: implemented
depende_de: [S27-02]
---

# S27-03 — Pago manual: instrucciones y comprobante

## Contexto y valor
Con S27-02 el cliente hace el pedido y elige cómo pagar, pero no sabe a qué número o cuenta
consignar, y la empresa no recibe prueba del pago. Esta historia muestra las instrucciones de la
empresa (Nequi, Daviplata, cuenta bancaria, QR) y deja que el cliente suba su comprobante, que la
empresa ve en Pedidos antes de registrar el cobro. Es la v1 de pagos acordada; Wompi llega en S27-05.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **G1 · Configuración** en Mi empresa → Tienda en línea → "Formas de pago": número de Nequi,
  número de Daviplata, datos de la cuenta bancaria (texto libre: banco, tipo, número, titular), un
  QR opcional (Bre-B, Nequi o el del banco) y casillas para "Contra entrega" y "Pagar al recoger".
- **G2 · Qué ve el cliente:** solo las formas de pago que la empresa configuró. Nequi, Daviplata y
  transferencia aparecen solo si tienen sus datos. Si la empresa no configuró nada, se ofrecen
  "Contra entrega" y "Pagar al recoger" (lo de hoy).
- **G3 · Después del pedido:** la pantalla "¡Pedido recibido!" muestra las instrucciones del
  método elegido, con el valor exacto, la referencia `#CODIGO` y el QR. Debajo, "Subir
  comprobante" (JPG, PNG, WEBP o PDF; máximo 5 MB). Es opcional; si no lo sube ahí, lo podrá
  subir con el enlace de seguimiento (S27-04).
- **G4 · El comprobante es privado:** solo lo ve la empresa (dueño, admin y operativos con acceso a
  Vender). En Pedidos, la marca "Comprobante recibido" y "Ver comprobante" (enlace temporal de 5
  minutos). La empresa revisa su Nequi o su banco y registra el cobro con el flujo que ya existe
  (Nequi y Daviplata = "transferencia").
- **G5 · Un comprobante por pedido:** si lo sube otra vez, reemplaza al anterior, con un máximo de
  5 subidas por pedido.
- **G6 · Enlace secreto del pedido:** cada pedido de la tienda tiene un código secreto (UUID
  aleatorio) que solo conoce quien lo hizo. Es la "llave" para subir el comprobante, y en S27-04
  también para seguir el pedido.

## Alcance
- **BD:**
  - `tenants`: `store_nequi`, `store_daviplata`, `store_bank_info`, `store_payment_qr_url`,
    `store_cash_on_delivery`, `store_pay_in_store`.
  - `sales`: `public_token` (uuid único, solo en pedidos de la tienda), `payment_proof_path`,
    `payment_proof_at` y `payment_proof_count`.
  - `store_info` devuelve las formas de pago activas y sus datos. `place_store_order` rechaza un
    método que la tienda no ofrece y además devuelve el `public_token`.
  - Bucket privado `payment-proofs`: anon sube solo dentro de la carpeta de un token válido; la
    empresa lee los de su empresa.
  - RPC `attach_payment_proof(p_token, p_path)`.
- **Tienda:** el formulario ofrece solo los métodos activos; la pantalla de éxito muestra las
  instrucciones, el QR y la subida del comprobante.
- **Miel:** formulario de formas de pago en Mi empresa; en Pedidos, "Comprobante recibido" y "Ver
  comprobante".
- Textos es/en/fr.

## NO-alcance (explícito)
- Pago en línea (S27-05), página de seguimiento y avisos (S27-04), validar el comprobante
  automáticamente, conciliación bancaria.

## Criterios de aceptación
1. **Dado** una empresa con Nequi configurado y "Contra entrega" apagado **cuando** el cliente abre
   el carrito **entonces** ve Nequi y no ve Contra entrega. Pedir con un método apagado falla en la
   BD (`payment_invalid`).
2. **Dado** un pedido con Nequi **entonces** la pantalla de éxito muestra el número de Nequi, el
   valor exacto, la referencia `#CODIGO` y el QR si existe.
3. **Dado** la pantalla de éxito **cuando** el cliente sube una foto del comprobante **entonces** ve
   "Comprobante enviado", y en Pedidos el pedido muestra "Comprobante recibido" con "Ver
   comprobante". Un archivo de más de 5 MB o de otro tipo se rechaza con un mensaje claro.
4. **Dado** un token falso, el de otro pedido de otra empresa o la sexta subida **entonces** no se
   adjunta nada. Un visitante no puede leer comprobantes, ni siquiera el suyo, una vez subido.
5. En 375px las instrucciones, el QR (como máximo 240px) y la subida caben sin scroll horizontal.

## Modelo de datos y migraciones
Migración `20261007160000_pago-manual-tienda.sql` (después de la de S27-02):
```sql
alter table tenants add column store_nequi text, add column store_daviplata text,
  add column store_bank_info text, add column store_payment_qr_url text,
  add column store_cash_on_delivery boolean not null default true,
  add column store_pay_in_store boolean not null default true;
-- CHECK: celulares de 7 a 15 dígitos; bank_info de hasta 300 caracteres.
alter table sales add column public_token uuid unique, add column payment_proof_path text,
  add column payment_proof_at timestamptz, add column payment_proof_count int not null default 0;
```
`store_info` se reemplaza: `drop function` + `create`, porque cambia su tipo de retorno.
`place_store_order` también se reemplaza para validar los métodos activos y devolver
`(order_code, total, token)`.

## Políticas RLS requeridas
- `storage.objects`, bucket `payment-proofs` (privado):
  - **insert** para anon y authenticated si
    `public.store_order_token_ok((storage.foldername(name))[1])`, que es true solo si existe un
    pedido de la tienda con ese token y menos de 5 subidas;
  - **select** para authenticated si el pedido de ese token pertenece a una de sus empresas.
- Sin update ni delete para anon.

## Funciones RPC e invariantes
- `attach_payment_proof(p_token uuid, p_path text)`, security definer y grant a anon: el token
  existe en un pedido `source='store'` no cancelado; `p_path` empieza con `<token>/`; menos de 5
  subidas. Guarda la ruta y la fecha, y suma 1 al contador. Si no: `proof_invalid`.
- `store_order_token_ok(text) → boolean`, security definer, usada por la política.
- `store_info`: los mismos campos más `payments jsonb`, por ejemplo `{"nequi": "300…",
  "daviplata": null, "transfer": "Bancolombia…", "qr": "https://…", "cash_on_delivery": true,
  "in_store": true}`.

## Casos borde
- La empresa borra el número de Nequi con pedidos ya hechos: los pedidos siguen; los nuevos ya no
  ofrecen Nequi.
- El cliente cierra la página sin subir el comprobante: lo podrá subir con el seguimiento (S27-04);
  mientras tanto la empresa lo contacta por teléfono.
- Comprobante PDF: "Ver comprobante" lo abre en una pestaña nueva.
- Pedido cancelado: ya no acepta comprobantes.

## Consideraciones de seguridad
- El token es un UUID aleatorio de 122 bits y la subida se limita a su carpeta. No se puede listar
  ni leer el bucket como anon. Tipo y tamaño se validan en el navegador, en la server action y con
  los límites del bucket (`allowed_mime_types`, `file_size_limit`).
- Los comprobantes tienen datos personales: bucket privado y enlace firmado de 5 minutos solo para
  la empresa.
- El QR y los números de pago son públicos a propósito: la empresa decide publicarlos.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1,2 | pgTAP | supabase/tests/S27-03-pago-manual.sql | store_info.payments según la configuración; place_store_order rechaza métodos apagados y devuelve el token |
| 3,4 | pgTAP | (mismo) | attach_payment_proof: feliz, token falso, carpeta ajena, sexta subida, pedido cancelado; store_order_token_ok |
| 1 | Vitest | src/lib/store/payments.test.ts | métodos ofrecidos según la configuración (G2) e instrucciones por método |
| 3 | Vitest | src/actions/store-payment.test.ts | validación de tipo y tamaño, token, mapeo de errores |
| 1 | Vitest | src/actions/online-store.test.ts | guardar las formas de pago (Zod: celulares, largo) |

Las políticas de Storage no se pueden probar en PGlite: el humano las verifica subiendo un
comprobante real (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos G1–G6 pendientes de confirmar.
- 2026-10-07 · aprobada por el humano con G1–G6 tal cual.
- 2026-10-07 · implementada. Cada comprobante es un archivo nuevo en `<token>/<uuid>.<ext>` (solo
  insert en Storage; el pedido apunta al último). "Ver comprobante" = ruta
  `/ventas/pedidos/comprobante/[id]` → enlace firmado de 5 min. QR en el bucket público
  `company-logos`. El test de S27-02 ahora configura Nequi en su tienda (Nequi solo se ofrece con
  número). pgTAP 20/20 (+ S27-01 25/25 y S27-02 26/26) en PGlite; lint, tsc, `npm test` 571/571,
  `next build` ✓. **Falta:** aplicar la migración, probar una subida real (las políticas de Storage
  no corren en PGlite) y ver el flujo en el celular.
