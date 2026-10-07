---
id: S27-01
titulo: Tienda pública de la empresa — activar y catálogo marca blanca
estado: implemented
depende_de: [S19-02, S26-01]
---

# S27-01 — Tienda pública: activar y catálogo

## Contexto y valor
Primera parte de E27. Cada empresa que contrata Miel quiere que sus clientes vean sus productos
desde el celular o el computador y compren. Esta historia hace la vitrina: el dueño activa su
tienda y el cliente ve el catálogo con la marca de la empresa. El carrito y el pedido llegan en
S27-02.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **E1 · Dirección en local:** `/tienda/<direccion>` (por ejemplo `/tienda/dulce-miel`). El
  subdominio `<direccion>.<dominio>` llega con el servidor central (S27-07); la `<direccion>` es la
  misma.
- **E2 · Qué se ve:** productos activos del inventario "productos", con precio mayor a 0 y canal
  de venta "internet" o "ambos" (S19-05; los "solo tienda" no salen). Los
  agotados se ven con la etiqueta "Agotado" en vez de ocultarse. Nunca se muestran el costo ni la
  cantidad exacta: solo "Disponible" o "Agotado", según la suma de todas las bodegas.
- **E3 · Precio:** se muestra el precio final al consumidor, con descuento e IVA incluidos (lo
  exige la norma de protección al consumidor), y el precio anterior tachado si hay descuento.
- **E4 · Idiomas (pedido del humano al aprobar):** la tienda está en español, inglés y francés,
  con un selector en el encabezado (la misma cookie de idioma de Miel). Por defecto, español. Se
  traducen los textos de la tienda; el nombre y la descripción de los productos se muestran como
  los escribió la empresa (son datos, no textos de la app).
- **E5 · Marca blanca:** título, ícono de la pestaña, ícono de la app instalada, colores y textos
  con el nombre y el logo de la empresa. Ni el logo ni el nombre de Miel aparecen. Sin logo, se usa
  la inicial de la empresa sobre su color.

## Alcance
- **Mi empresa → "Tienda en línea"** (dueño o admin): casilla "Activar tienda", "Dirección"
  (minúsculas, números y guiones, 3–40 caracteres, única, con palabras reservadas como `www`,
  `app`, `api`, `admin` o `miel`), "Color de la tienda" (selector de color, hexadecimal) y el
  enlace para copiar.
- **Página pública** `/tienda/[direccion]`, sin iniciar sesión:
  - Encabezado con el logo o la inicial y el nombre de la empresa.
  - Buscador y filtro por categoría.
  - Tarjetas con foto, nombre, descripción corta, precio y Disponible o Agotado.
  - Pie con los datos de contacto de la empresa (S26-01).
  - Selector de idioma (ES/EN/FR).
  - Se instala como app con el nombre, logo y color de la empresa (`manifest` propio).
- **BD:** `tenants` gana `store_enabled`, `store_slug` (único) y `store_color`. Dos funciones
  públicas de solo lectura, `store_info(p_slug)` y `store_catalog(p_slug)`, que solo responden si
  la tienda está activa y solo devuelven columnas públicas.
- Si la tienda está apagada o no existe: página "Tienda no disponible" (404) sin marca de nadie.

## NO-alcance (explícito)
- Carrito, pedido y pagos (S27-02, S27-03 y S27-05), seguimiento (S27-04), subdominios y dominio
  propio (S27-06 y S27-07), página de detalle por producto, SEO avanzado y traducción de los productos.

## Criterios de aceptación
1. **Dado** el dueño en Mi empresa **cuando** activa la tienda con dirección `dulce-miel` y un color
   **entonces** `/tienda/dulce-miel` muestra su logo, nombre, color y productos. Si la dirección ya
   está tomada o es reservada, aparece un error claro. Un operativo no ve la sección.
2. **Dado** un visitante sin sesión **cuando** abre la tienda **entonces** ve solo los productos
   vendibles activos con precio final (descuento + IVA), el anterior tachado si hay descuento, y
   "Agotado" cuando la suma de las bodegas es 0 o menos. No ve costo, cantidades, insumos ni
   productos archivados.
3. **Dado** una tienda apagada, una dirección inexistente o una empresa distinta **entonces**
   `store_catalog` y `store_info` no devuelven nada, y la página responde "Tienda no disponible".
   Con la llave pública (anon) no se puede leer `products`, `tenants` ni `stock_movements`
   directamente.
4. **Dado** la tienda abierta **entonces** el título, el ícono y el manifest de instalación son de
   la empresa, y "Miel" no aparece en el HTML visible ni en el manifest.
5. En 375px la grilla queda en 2 columnas, el buscador y las categorías caben y no hay scroll
   horizontal. En escritorio la grilla se amplía hasta 4 columnas.

## Modelo de datos y migraciones
Migración `20261007140000_tienda-publica.sql`:
```sql
alter table tenants add column store_enabled boolean not null default false,
  add column store_slug text, add column store_color text;
create unique index tenants_store_slug_key on tenants (lower(store_slug)) where store_slug is not null;
-- CHECK: store_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'; store_color ~ '^#[0-9a-fA-F]{6}$'
```
La escritura va como en S26-01: la server action actualiza `tenants` (la RLS ya solo deja a
admin). Las reglas viven en la BD para que no se puedan saltar: CHECK de formato, CHECK de
palabras reservadas, CHECK "activar exige dirección" (`not store_enabled or store_slug is not
null`) e índice único. La action traduce 23505 → `store.errors.slugTaken` y 23514 →
`store.errors.slugInvalid` / `colorInvalid`.

## Políticas RLS requeridas
Sin políticas nuevas para `anon`. Las tablas siguen cerradas al público; el acceso público es
SOLO a través de `store_info` y `store_catalog` (security definer, `grant execute` a `anon`), que
filtran por `store_enabled` y devuelven columnas enumeradas.

## Funciones RPC e invariantes
- `store_info(p_slug) → (name, logo_url, store_color, phone, email, address, city)`. Vacío si la
  tienda no existe o está apagada.
- `store_catalog(p_slug) → setof (product_id, name, description, photo_url, category, price,
  discount_percent, tax_rate, available boolean)`. Solo `products.active`, `inventory =
  'productos'` y `price > 0` y `sales_channel in ('online','both')`; `available` = suma de stock > 0. Nunca devuelve costo, SKU ni
  cantidades.
- Sin RPC de escritura: `tenants` + CHECKs (ver Modelo de datos).

## Casos borde
- Cambiar la dirección rompe el enlace viejo (se avisa al guardar).
- Producto sin foto: se muestra un recuadro con la inicial del producto.
- Logo WEBP o SVG: sirve en la web. En el manifest se usa tal cual (los navegadores aceptan PNG,
  JPG, WEBP y SVG).
- Empresa sin categorías: el filtro no aparece.
- Muchos productos (más de 500): v1 los muestra todos, filtrados en el cliente. Paginación cuando
  haga falta (se anota).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Primera superficie pública de Miel: todo lo que lee `anon` pasa por las dos funciones y nunca
  por tablas. pgTAP verifica que `anon` no lea `products`, `tenants` ni `stock_movements` y que
  las funciones no filtren datos de tiendas apagadas.
- Para `p_slug` se valida el formato antes de consultar. No hay forma de listar todas las tiendas:
  no se puede enumerar empresas.
- El texto de productos y empresas se renderiza como texto (React escapa); nunca HTML.
- El color se valida con regex antes de ir al CSS inline (`--store-color`), así que no se puede
  inyectar CSS.
- Las imágenes vienen de los buckets públicos del propio proyecto (la CSP ya los permite).
- ADR-044: superficie pública y marca blanca.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1,3 | pgTAP | supabase/tests/S27-01-tienda-publica.sql | ajustes por update (admin sí, operativo no cambia nada, tomada 23505, reservada/formato/color/activar sin dirección 23514); store_info/catalog vacíos con la tienda apagada o inexistente |
| 2,3 | pgTAP | (mismo) | como `anon`: solo vendibles activos con precio, available correcto, sin costo; tablas base cerradas a anon |
| 2 | Vitest | src/lib/store/price.test.ts | precio final con descuento e IVA, y el precio tachado |
| 1 | Vitest | src/lib/store/slug.test.ts | normalización y validación de la dirección, palabras reservadas |
| 1 | Vitest | src/actions/store.test.ts | Zod y mapeo de errores (23505/23514) |
| 4 | Vitest | src/app/tienda/[slug]/manifest.webmanifest/route.test.ts | manifest con nombre, color y logo de la empresa, sin "Miel"; 404 si está apagada |

El humano corre el pgTAP, aplica la migración y revisa la tienda en el celular (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos E1–E5 pendientes de confirmar.
- 2026-10-07 · aprobada por el humano; E4 cambia a varios idiomas (es/en/fr) a su pedido.
- 2026-10-07 · ajuste antes de codificar: sin RPC `set_store_settings` (la RLS de tenants ya limita a
  admin; las reglas van como CHECK) y la tienda filtra por el canal de venta del producto (S19-05).
- 2026-10-07 · implementada. `store_info` también devuelve `currency` (precio en la moneda de la
  empresa). Acción en `src/actions/online-store.ts` y textos en `onlineStore.*` (`store` ya era el
  modo tienda de trabajadores, S21-03). Marca blanca: layout `/tienda` anula la metadata raíz y el
  ícono de Miel pasó a `public/icon.svg`. pgTAP 25/25 en PGlite con stubs; lint, tsc, `npm test`
  y `next build` ✓. **Falta:** aplicar la migración, `supabase test db`, ver la tienda con datos
  reales y a 375px.
