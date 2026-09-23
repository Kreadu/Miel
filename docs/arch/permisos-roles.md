---
topic: permisos-por-rol
status: vigente
related: [multitenancy-rls.md, ../data-model.md]
---

# Permisos por rol × módulo

Fuente de verdad de autorización (ADR-018/019). Toda spec referencia esta matriz en su sección
"Políticas RLS requeridas" — no se decide permiso por permiso en cada sesión.
Roles (memberships.role): `owner` (dueño), `admin` (gestión completa), `member` (operativo).

Principio: **member opera, no ve finanzas.** owner y admin ven y hacen todo; se distinguen
solo en administración del tenant.

## Matriz

| Módulo / acción | owner | admin | member |
|---|---|---|---|
| Ver inventario, stock y kardex (cantidades) | ✔ | ✔ | ✔ |
| Ver costo de producto (cost, margen) | ✔ | ✔ | ✖ |
| Ver precio de venta e IVA de producto (price, tax_rate) | ✔ | ✔ | ✔ (ADR-029 — necesario para operar el POS) |
| Gestionar catálogos (products, warehouses, suppliers, recetas) | ✔ | ✔ | ✖ |
| Crear cliente (`customers`, incl. alta rápida en el POS) | ✔ | ✔ | ✔ (ADR-033) |
| Editar/archivar cliente | ✔ | ✔ | ✖ |
| Asociar producto↔proveedor manualmente (`supplier_products`) | ✔ | ✔ | ✖ (se puebla automático al recibir compra, ADR-032) |
| Registrar movimientos de stock, recibir compras, registrar producción | ✔ | ✔ | ✔ |
| Crear/editar órdenes de compra; cancelarlas | ✔ | ✔ | ✖ |
| Pagos a proveedores y CxP | ✔ | ✔ | ✖ |
| Crear ventas, POS (vender, cobrar), despachar | ✔ | ✔ | ✔ |
| Cancelar ventas | ✔ | ✔ | ✖ |
| Descuentos por ítem | ✔ | ✔ | ✔ (reporte visible solo owner/admin) |
| Abrir/cerrar SU caja (arqueo propio) | ✔ | ✔ | ✔ |
| Cerrar caja de otro usuario / ver todas las sesiones | ✔ | ✔ | ✖ |
| Pagos de clientes y CxC | ✔ | ✔ | ✔ (registrar cobro) / ✖ (saldos globales) |
| CRM: ver/registrar interacciones, historial de cliente | ✔ | ✔ | ✔ |
| Gastos: registrar | ✔ | ✔ | ✖ |
| Finanzas: P&L, flujo de caja, rentabilidad, monthly_expenses | ✔ | ✔ | ✖ |
| Dashboard gerencial | ✔ | ✔ | ✖ |
| Invitar usuarios, cambiar roles, editar datos del tenant | ✔ | ✔ | ✖ |
| Facturación del SaaS (plan, pago) | ✔ | ✖ | ✖ |
| Eliminar el tenant | ✖ | ✖ | ✖ — solo plataforma vía `service_role` (ADR-019) |

## Materialización (dos capas, ambas obligatorias)

1. **BD (la frontera real)**: políticas RLS por rol sobre el patrón de
   `multitenancy-rls.md` — p. ej. `and exists (select 1 from memberships m where
   m.tenant_id = <tabla>.tenant_id and m.user_id = auth.uid() and m.role in
   ('owner','admin'))` para escrituras restringidas. Columnas sensibles (costos/márgenes)
   se protegen exponiendo a `member` vistas sin esas columnas o RPCs de lectura filtrada —
   la spec de cada historia fija el mecanismo. `tenants` no lleva política de delete:
   la eliminación es operación de plataforma fuera de banda con `service_role` (ADR-019).
2. **UI (experiencia)**: ocultar módulos/acciones no permitidos según el rol del tenant
   activo. La UI nunca es la frontera de seguridad (regla de multitenancy-rls.md).

Cambios a esta matriz: ADR nuevo + actualización aquí, nunca solo en una spec.
