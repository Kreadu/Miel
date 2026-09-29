---
id: S19-02
titulo: Catálogo de productos — foto, descripción, precio, descuento
estado: approved
depende_de: [S19-01, S2-02]
---

# S19-02 — Catálogo de productos: foto, descripción, precio, descuento

## Contexto y valor

El dueño pidió renombrar "Catálogo online" a solo "Catálogo" y que deje de ser un cartel
"Próximamente": adentro tiene que poder generar productos con foto, descripción, precio y
descuento — un botón "Generar producto" abre el alta.

## Alcance

- Reusa la tabla `products` existente (S2-02) en vez de crear una entidad paralela — el catálogo
  es una vista distinta de los mismos productos, no algo separado. Gana dos columnas: `photo_url
  text` (nullable) y `discount_percent numeric(5,2) not null default 0` (`CHECK` 0–100).
- `products_catalog` (la vista que ya enmascara `cost` para `member`, ADR-029) expone las dos
  columnas nuevas sin enmascarar — no son sensibles, son datos de venta al público.
- **Storage**: bucket nuevo `product-photos` en Supabase Storage, público en lectura. RLS en
  `storage.objects`: solo owner/admin del tenant puede subir/borrar, y solo dentro de su propio
  prefijo `{tenant_id}/...` (mismo criterio de aislamiento que el resto del esquema).
- Alta simplificada de producto desde el catálogo (`createCatalogProduct`, Server Action nueva):
  pide **solo** nombre, descripción, precio, descuento y foto (opcional) — no SKU/costo/IVA/tipo
  ni bodega, que son de la ficha de inventario (`/inventario/productos`, sin cambios). El SKU se
  genera solo (`CAT-XXXXXXXX`); `unit='unidad'`, `kind='resale'`, `cost=0`, `tax_rate=0`,
  `min_stock=0` por defecto — el dueño puede después completarlos en `/inventario/productos` si
  hace falta, misma fila (`products` es una sola tabla).
- Página nueva `ventas/catalogo/page.tsx`: grid de tarjetas (foto o placeholder, nombre,
  descripción, precio — tachado + precio con descuento si `discount_percent > 0`). Botón "Generar
  producto" (visible solo si `role !== "member"`, mismo criterio que `/inventario/productos`) que
  despliega el formulario de alta inline.
- `ventas/page.tsx`: el acceso pasa de decir "Catálogo online" (con badge "Próximamente", sin
  link) a decir solo **"Catálogo"**, como link real a `/ventas/catalogo`. Mismo gating
  (`active.sellsVirtual`) que ya tenía.

## NO-alcance (explícito)

- **Carrito y checkout**: siguen sin construirse. El catálogo de esta historia es de
  gestión/visualización, no una tienda pública sin login todavía.
- **Pagos**: pospuestos por el humano, ninguna historia de E19 los toca.
- Editar/archivar un producto del catálogo desde `/ventas/catalogo`: se hace desde
  `/inventario/productos` (misma fila, ficha completa) — no se duplica esa UI acá.
- Compresión/recorte de imágenes: se sube el archivo tal cual (validado por tipo y tamaño
  máximo 5 MB) — sin resize del lado del servidor.
- Mostrar el catálogo a `sellsPhysical`-only sin `sellsVirtual`: fuera de alcance, el gating de
  S19-01 no se toca.

## Supuestos (sin confirmar con el humano, documentados por ambigüedad de spec — AGENTS.md)

- "Descuento" se interpreta como **porcentaje** (0–100), no monto fijo — es el patrón más común
  para un catálogo chico y coincide con `tax_rate` (que también es %).
- El precio que se ingresa en el alta simplificada es el precio final de venta, sin IVA aparte
  (`tax_rate=0` por defecto en esta vía) — distinto del alta de inventario, que sí pide IVA.

## Criterios de aceptación

1. **Dado** un tenant con `sellsVirtual` **cuando** entra a `/ventas` **entonces** ve un acceso
   que dice "Catálogo" (sin "online", sin "Próximamente") y lleva a `/ventas/catalogo`.
2. **Dado** un owner/admin **cuando** entra a `/ventas/catalogo` **entonces** ve el botón "Generar
   producto"; un `member` no lo ve.
3. **Dado** un owner/admin **cuando** completa nombre, precio y descuento (sin foto) y envía
   **entonces** el producto aparece en el grid con precio tachado + precio final si hay descuento.
4. **Dado** un owner/admin **cuando** además adjunta una foto válida (jpg/png/webp, <5MB)
   **entonces** la foto se sube y se muestra en la tarjeta.
5. **Dado** un `member` **cuando** intenta invocar la acción de crear directamente (sin UI)
   **entonces** la base de datos lo rechaza (RLS `products_admin_write`, sin cambios).
6. **Dado** cualquiera **cuando** se intenta guardar `discount_percent` fuera de 0–100
   **entonces** la base de datos lo rechaza (`CHECK`).

## Modelo de datos y migraciones

```sql
alter table public.products
  add column photo_url text,
  add column discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100);

create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  photo_url, discount_percent,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate
from public.products
where tenant_id in (select public.user_tenant_ids());

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "product_photos_public_read" on storage.objects for select
  using (bucket_id = 'product-photos');

create policy "product_photos_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'product-photos'
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "product_photos_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'product-photos'
    and public.user_is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );
```

## Políticas RLS requeridas

- `products`: sin cambios (`products_admin_write`/`products_admin_update`/`products_tenant_select`
  de S2-02 ya cubren las columnas nuevas, son parte de la misma fila).
- `storage.objects` (bucket `product-photos`): lectura pública (el catálogo eventualmente se
  muestra sin login); escritura solo owner/admin del tenant dueño del prefijo de carpeta —
  mismo criterio de aislamiento multitenant que el resto del esquema, aplicado vía
  `storage.foldername(name)[1]` como tenant_id.

## Funciones RPC e invariantes

Ninguna nueva — el insert es directo a `products` (no hay lógica transaccional de stock
involucrada, regla 2 de AGENTS.md no aplica: sin movimiento de inventario en esta vía).

## Casos borde

- Foto de tipo no permitido o >5MB: rechazada en el servidor antes de subir a Storage, con
  mensaje claro (no llega a insertar el producto sin foto por error).
- SKU autogenerado que colisiona (extremadamente improbable, 8 hex chars): el insert falla con
  `23505`, mensaje pide reintentar — sin retry automático en esta historia.
- Producto sin foto: la tarjeta muestra un placeholder ("Sin foto"), no rompe el layout del grid.

## Consideraciones de seguridad (docs/arch/seguridad.md)

- Boundary nuevo (`createCatalogProduct`): Zod valida nombre/precio/descuento; la foto se valida
  por `type`/`size` antes de subir (no se confía en la extensión del nombre de archivo).
- El bucket es público en lectura a propósito (catálogo de cara a clientes) — no subir ahí nada
  que no deba ser público.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 5, 6 | pgTAP | `supabase/tests/S19-02-catalogo-productos.sql` | member no puede insertar (RLS existente); `CHECK` de `discount_percent` rechaza fuera de 0–100; `products_catalog` expone las columnas nuevas sin enmascarar |
| 3, 4 (Zod) | Vitest | `src/lib/validation/catalog.test.ts` | schema acepta precio/descuento válidos, rechaza fuera de rango |
| 1, 2, 3, 4 | manual (sin Playwright en este sandbox) | `ventas/catalogo/` | verificado a mano por el humano vía `npm run dev` |

**Nota (regla 9):** sin Docker en este sandbox, `supabase test db` no se pudo correr — pgTAP
escrito, pendiente de ejecución real.

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión ("Donde dice catalogo on line,
  solo debe decir catálogo, y dentro del catálogo crearemos un producto hay que generar una tecla
  que diga generar producto, ahi hay que ingresar foto, descripcion, precio, descuento").
