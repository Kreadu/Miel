---
id: S19-24
titulo: Un solo producto y un solo formulario en Inventario y Catálogo
estado: implemented
depende_de: [S19-02, S19-15, S19-20, S19-21]
---

# S19-24 — Formulario único de producto

## Contexto y valor

Pedido del humano 2026-09-29: los productos se crean desde Productos (inventario) o desde el
Catálogo y se ven en los dos lados; "+ Nuevo producto" en Productos es lo mismo que "Generar
producto" del Catálogo; el formulario suma unidad, tipo, stock mínimo, costo y precio de venta
a lo que ya tenía; Productos tiene las categorías; se elimina la estructura vieja de productos
de inventario y queda "todo así como el catálogo". Decisiones del humano: SKU de las dos formas
(se genera solo si está vacío, o se escribe); IVA editable; materia prima fuera del catálogo.
Aprobación: pedido explícito, misma sesión.

## Alcance

- `productSchema` único (SKU opcional, IVA editable, descuento, canal, categoría); se borra
  `catalogProductSchema` y `productWithStockSchema`.
- `createProduct`/`updateProduct` únicos en `src/actions/products.ts` (insert/update con
  columnas explícitas, SKU `PRD-XXXXXXXX` si está vacío, foto). Se borran
  `createCatalogProduct`/`updateCatalogProduct`. Toda mutación revalida Productos, Inventario y
  Catálogo; las de categorías revalidan Catálogo y Productos.
- Componentes compartidos en `src/components/products/`: `ProductFields`, `ProductEditor`,
  `NewProductButton`, `ProductCard` (con "Receta" para terminados), `CategoryManager`,
  `CategoryPicker`, `CategoryFilter`. Carga compartida `src/lib/products/load.ts`; stock
  desglosado `stockByProduct` (`src/lib/stock.ts`).
- `/inventario/productos`: grilla de tarjetas como el Catálogo, "Generar categorías",
  "+ Nuevo producto", filtro por categoría. Se borran la tabla, `ProductForm`, `ProductRow`,
  `ArchiveProductAction` y la edición por `?editar=`.
- `/ventas/catalogo`: solo terminado y reventa.
- Stock: solo lectura (S19-20); el alta ya no carga stock inicial.

## NO-alcance / notas

- La RPC `create_product_with_stock` (S13-01) queda sin uso en la app; no se borra de la BD.
- Productos archivados ya no se listan ni se reactivan desde la UI (igual que el Catálogo).

## Criterios de aceptación

1. Un producto creado en Productos aparece en el Catálogo (si es terminado/reventa) y viceversa.
2. El mismo formulario (con unidad, tipo, stock mínimo, costo, precio, IVA, descuento, canal,
   categoría, foto, SKU) en ambos lados.
3. SKU vacío → se genera; SKU escrito → se respeta; duplicado → mensaje claro.
4. La materia prima no aparece en el Catálogo.

## Tests

- Vitest: `src/lib/validation/products.test.ts`, `src/actions/products.test.ts`,
  `src/lib/stock.test.ts`. e2e `core-flow` actualizado (sin correr).
