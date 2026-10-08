---
id: S28-05
titulo: Facturas de proveedores — listado por período con enlace a la orden y CSV
estado: implemented
depende_de: [S28-01, S28-03, S28-04]
---

# S28-05 — Facturas de proveedores

## Decisiones (aprobadas por el humano el 2026-10-08)
- **Botón** "Facturas de proveedores" en Compras, arriba (solo dueño/admin), que abre
  `/compras/facturas`.
- **Filtros** (formulario GET):
  - desde–hasta por fecha de la factura (por defecto, del 1 del mes a hoy);
  - proveedor;
  - número de factura;
  - "Ver anuladas".
- **Tabla:** fecha, número, proveedor, orden (enlace a su recepción), subtotal sin IVA, IVA,
  total, vencimiento y "Ver archivo" (URL firmada).
- **Al pie, el total del período** sin las anuladas. El IVA es el descontable.
- **"Descargar CSV"** con los mismos filtros (`/compras/facturas/csv`): separador `;`, decimales
  con coma y BOM UTF-8, para abrirlo bien en Excel en Colombia.
- **Sin migración:** la RLS de `purchase_invoices` ya restringe a dueño/admin, y la página y el
  CSV dan 404 a un miembro.

## Tests
Vitest de `src/lib/purchases/invoice-list.test.ts`: filtros, totales sin anuladas y formato del CSV.

## Historial
- 2026-10-08 · approved ("si") e implemented. Sin revisión visual.
