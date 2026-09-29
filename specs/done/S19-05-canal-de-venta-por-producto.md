---
id: S19-05
titulo: Canal de venta por producto — solo internet, solo tienda, o ambos
estado: implemented
depende_de: [S19-02]
---

# S19-05 — Canal de venta por producto: solo internet, solo tienda, o ambos

## Contexto y valor

S19-01 dejó el canal (física/virtual) a nivel de **empresa** (¿la empresa vende físico, online, o
ambos?). El dueño pidió un nivel más fino: cada **producto**, al generarlo, debe poder marcarse
como solo internet, solo tienda, o disponible por ambas — un mismo tenant con ambos canales puede
tener productos que solo tiene sentido vender en el local (p. ej. algo perecedero) y otros que
solo vende online.

## Alcance

- `products` gana `sales_channel text not null default 'both' check (in ('online', 'in_store',
  'both'))`. Default `'both'`: un producto existente o creado sin tocar el campo sigue apareciendo
  en todos lados, igual que hoy (retrocompatible, mismo criterio que S19-01 con
  `sells_physical`/`sells_virtual`).
- `products_catalog` expone `sales_channel` (agregado **al final** del select — `create or
  replace view` no permite insertarlo en el medio, lección de S19-02/ADR-035).
- Formulario de catálogo (alta y edición, `catalog-product-fields.tsx`): selector "¿Dónde se
  vende?" con 3 opciones (Solo internet / Solo tienda / Ambas), default "Ambas".
- **Filtro real, solo donde opera físicamente** — es lo que le da sentido al campo:
  - `/ventas/pos` y `/ventas/pedidos` (canal físico, staff vendiendo en persona) solo listan
    productos con `sales_channel in ('in_store', 'both')`.
- **Corrección 2026-09-28 (mismo día, tras prueba real del humano):** `/ventas/catalogo` **NO**
  filtra por canal. Es la vista de **gestión** del catálogo (ahí se crea/edita/elimina un
  producto, S19-02/S19-03) — filtrar ahí hacía que un producto marcado "Solo tienda" pareciera
  borrado justo al guardarlo, en el único lugar donde se administra. El criterio original 2
  (abajo) queda invertido; ver Historial.
- Cada tarjeta del catálogo muestra un badge chico ("Solo internet"/"Solo tienda") cuando el
  canal no es "Ambas", para que se vea sin tener que entrar a editar.

## NO-alcance (explícito)

- `/inventario/productos` (ficha completa) no gana este campo en esta historia — sigue siendo la
  misma tabla `products`, así que un producto creado ahí queda en `'both'` por default y es
  editable desde el catálogo si hace falta acotarlo. Agregarlo también a la ficha completa (y a
  la RPC `create_product_with_stock`) queda para otra historia si el dueño lo pide.

## Criterios de aceptación

1. **Dado** un owner/admin **cuando** genera o edita un producto desde el catálogo **entonces**
   puede elegir "Solo internet", "Solo tienda" o "Ambas" (default "Ambas").
2. ~~**Dado** un producto marcado "Solo tienda" **cuando** alguien entra a `/ventas/catalogo`
   **entonces** no aparece.~~ **Invertido por la corrección de arriba:** un producto marcado
   "Solo tienda" (o cualquier canal) **siempre** sigue visible en `/ventas/catalogo`, con su
   badge de canal — nunca desaparece de la gestión.
3. **Dado** un producto marcado "Solo internet" **cuando** alguien entra a `/ventas/pos` o
   `/ventas/pedidos` **entonces** no aparece.
4. **Dado** un producto "Ambas" (o cualquier producto preexistente, default) **cuando** se mira
   desde `/ventas/pos`/`/ventas/pedidos` **entonces** aparece.

## Modelo de datos y migraciones

```sql
alter table public.products
  add column if not exists sales_channel text not null default 'both';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_sales_channel_check') then
    alter table public.products
      add constraint products_sales_channel_check
      check (sales_channel in ('online', 'in_store', 'both'));
  end if;
end $$;

create or replace view public.products_catalog with (security_invoker = false) as
select
  id, tenant_id, sku, name, description, unit, kind, min_stock, active,
  created_by, created_at, updated_at,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  price::numeric as price,
  tax_rate::numeric as tax_rate,
  photo_url, discount_percent, sales_channel
from public.products
where tenant_id in (select public.user_tenant_ids());
```

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1 (Zod) | Vitest | `catalogProductSchema` acepta los 3 valores, default `both` |
| 2, 3, 4 | pgTAP | `CHECK` rechaza valores fuera del enum; `products_catalog` expone `sales_channel` |
| 1–4 (UI) | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · aprobada por el humano en la misma sesión ("Al ingresar el producto se debe dejar
  marcado si el producto se vende solo por internet, solo en tienda o si se puede adquirir por
  ambas partes").
- 2026-09-28 (misma sesión, más tarde) · el humano probó en vivo: editó un producto con foto,
  le puso "Solo tienda", y "me borró el producto" (dejó de verse en `/ventas/catalogo`, aunque
  seguía existiendo). Pidió que "siempre quede visible aunque le coloque la opcion de tienda,
  virtual o ambas". Corregido: se quitó el filtro por canal de `/ventas/catalogo` (queda como
  vista de gestión, sin filtrar), se agregó un badge de canal en la tarjeta para dar visibilidad
  sin esconder nada, y el filtro por canal se dejó únicamente en `/ventas/pos`/`/ventas/pedidos`
  (donde sí tiene sentido operativo: no ofrecerle a un vendedor en persona un producto
  "solo internet").
