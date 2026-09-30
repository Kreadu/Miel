---
id: S26-01
titulo: "Mi empresa" (logo y datos) y "Tu nombre" de cada usuario
estado: implemented
depende_de: []
---

# S26-01 — Mi empresa y tu nombre

## Contexto

Primera parte de E26 (orden de compra como documento, plan aprobado 2026-09-30). El PDF de la
orden necesita el logo y los datos de la empresa, y el nombre de quien pide, aprueba y envía
(el humano quiere que cada uno "se haga responsable"). Hoy las cuentas con correo no tienen
nombre y la empresa solo tiene nombre y NIT.

## Alcance

- **BD:** `tenants` gana `address`, `city`, `phone`, `email`, `logo_url`. `memberships` gana
  `display_name` (el nombre de esa persona en esa empresa). RPC `set_my_display_name(p_tenant_id,
  p_name)`: cada usuario cambia **solo su propio** nombre (la RLS de memberships solo deja escribir
  a admins). Bucket `company-logos` (lectura pública como las fotos de productos, escritura solo
  admin de la empresa, carpeta = id de la empresa).
- **Página "Mi empresa"** (`/empresa`, solo dueño/admin): nombre, NIT, dirección, ciudad,
  teléfono, correo y logo (JPG/PNG/WEBP, máx. 2 MB, con vista previa y "quitar logo").
- **Página "Mi perfil"** (`/perfil`, cualquier cuenta con correo): "Tu nombre" (obligatorio para
  pedir/aprobar/enviar órdenes de compra en S26-02/03 — aquí solo se explica).
- **Menú lateral (pie):** se muestra el nombre (o el correo si no hay) con enlace a "Mi perfil";
  dueño/admin ven además "Mi empresa". En modo tienda no aparece (el nombre es el del trabajador).
- Textos es/en/fr.

Fuera de alcance: usar estos datos en el PDF (S26-03); aprobadores (S26-02).

## Criterios

- El dueño sube el logo y los datos; se ven al volver a entrar. Un operativo no entra a
  "Mi empresa" (no encontrado) ni puede escribir el logo (storage lo rechaza).
- Cada usuario pone su nombre; no puede cambiar el de otro (la RPC solo toca su membresía).
- Nombre vacío o de más de 80 caracteres: error claro.
- pgTAP: `set_my_display_name` (propio sí, ajeno no, vacío no, otra empresa no); update de
  `tenants` solo admin; políticas del bucket. Vitest de acciones (validación, claves de error).
- Lint, tsc, `npm test`; migración y pgTAP los aplica/corre el humano.

## Notas de implementación

- Migración `20260930230000_mi-empresa-y-tu-nombre.sql` (independiente de las de S18; se puede
  aplicar en cualquier orden después de ellas). pgTAP `S26-01-mi-empresa-y-tu-nombre.sql`
  (10 pruebas), **sin correr aquí**. Tipos editados a mano.
- `actions/company.ts` (`saveCompany`, `setMyDisplayName`), `lib/validation/company.ts`, páginas
  `/empresa` y `/perfil`; pie del menú con el nombre (o el correo) → "Mi perfil" y "Mi empresa".
- Antes de aplicar la migración: el menú muestra el correo (sin romper) y "Mi empresa" da
  "no encontrado".
