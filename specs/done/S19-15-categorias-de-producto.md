---
id: S19-15
titulo: Categorías de producto en el Catálogo
estado: implemented
depende_de: [S19-02]
---

# S19-15 — Categorías de producto en el Catálogo

## Contexto y valor

El dueño pidió poder asignar un producto a una categoría, creándola desde el mismo alta del
producto o por separado, y filtrar el catálogo por categoría (botón "Todos" + uno por categoría).

## Alcance

- Tabla nueva `product_categories` (`tenant_id`, `name`, único por tenant) + `products.category_id`
  (nullable, `on delete set null` — borrar una categoría no borra productos).
- `products_catalog` expone `category_id` (al final del select, mismo criterio de S19-02/S19-05:
  `create or replace view` no permite insertar columnas en el medio).
- Gestión de categorías, dos caminos (ambos pedidos explícitamente):
  1. **Botón "Generar categoría"**, arriba de "Generar producto" — form inline mínimo (solo
     nombre), mismo patrón toggle que `CatalogProductForm`.
  2. **Desde el propio alta/edición de producto**: `CatalogProductFields` gana un selector de
     categoría existente + un campo "o escribí una nueva" — si se escribe un nombre nuevo, se
     crea junto con el producto en la misma operación (`getOrCreateCategoryId`, mismo patrón que
     el cliente genérico de S19-09).
- `/ventas/catalogo` gana una fila de filtro: "Todos" + un botón por categoría
  (`?categoria=<id>` en la URL, filtrado server-side — sin JS de cliente para esto).

## NO-alcance (explícito)

- Sin subcategorías (una sola categoría por producto, sin jerarquía).
- Sin editar/borrar categorías desde esta historia — solo crear y asignar. Renombrar/eliminar
  categorías queda para otra historia si hace falta.
- Categorías son solo del catálogo (`products.category_id`), no se extendió a
  `/inventario/productos` (mismo criterio de alcance que S19-05 con `sales_channel`).

## Criterios de aceptación

1. **Dado** un owner/admin **cuando** aprieta "Generar categoría" **entonces** puede crear una
   categoría con solo el nombre.
2. **Dado** un owner/admin generando/editando un producto **cuando** elige una categoría existente
   o escribe una nueva **entonces** el producto queda asignado (la nueva categoría se crea si no
   existía).
3. **Dado** categorías con productos asignados **cuando** se mira `/ventas/catalogo` **entonces**
   hay un botón "Todos" y uno por categoría; al elegir uno, el grid se filtra.

## Modelo de datos y migraciones

```sql
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.product_categories enable row level security;

create policy "product_categories_tenant_select" on public.product_categories for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "product_categories_admin_write" on public.product_categories for insert
  with check (public.user_is_tenant_admin(tenant_id));

grant select, insert on public.product_categories to authenticated, service_role;

alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete set null;
```

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–3 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · pedido por el humano ("hay que generar un espacio dentro del producto para
  asignarlo a una categoria... debe haber una tecla que muestra todos los productos y luego las
  teclas según la categoria").
