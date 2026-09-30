---
topic: backlog-maestro
status: vigente
related: [SPRINTS.md, GOVERNANCE.md]
---

# BACKLOG — Épicas e historias del MVP

Estados: `todo` → `spec-ready` → `in-progress` → `done` · (`blocked` en cualquier punto).
Una historia = una sesión agéntica o menos. Los criterios finos viven en la spec de cada
historia; aquí va el resumen y el grafo de dependencias.

## Épica E1 — Fundación multitenant (Sprint 1)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S1-01 | Como fundador quiero el esquema base multitenant (tenants, memberships, RLS, `user_tenant_ids()`) para que todo lo demás nazca aislado por empresa | migración base; RLS + aislamiento probado en pgTAP; test guardián en verde | — | done | specs/done/S1-01-tenants-auth.md |
| S1-02 | Como usuario quiero registrarme e iniciar sesión (email+password) para acceder a la app | signup, login, logout, recuperación de contraseña; middleware de sesión @supabase/ssr | S1-01 | done | specs/done/S1-02-auth-email-password.md |
| S1-03 | Como usuario nuevo quiero crear mi empresa (onboarding) para empezar a usarla como owner | crear tenant + membership owner en RPC atómica; redirección a la app | S1-02 | done | specs/done/S1-03-onboarding-crear-empresa.md |
| S1-04 | Como usuario quiero un layout de app con navegación y selector de empresa para moverme entre módulos | grupo (app) protegido; sidebar; tenant activo en servidor; visibilidad por rol | S1-03 | done | specs/done/S1-04-layout-tenant-activo.md |
| S1-05 | Como owner quiero invitar usuarios a mi empresa con un rol para trabajar en equipo | tabla invitations + RPC accept_invitation; roles admin/member; solo owner/admin invita (RLS por rol) | S1-04 | done | specs/done/S1-05-invitaciones-roles.md |

## Épica E2 — Inventario (Sprint 2)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S2-01 | Como admin quiero gestionar bodegas para organizar mi inventario | CRUD warehouses; RLS + aislamiento | S1-04 | done | specs/done/S2-01-bodegas.md |
| S2-02 | Como admin quiero gestionar productos (sku, tipo, costo, precio, IVA, stock mínimo) para catalogar materias primas, insumos y terminados | CRUD products con `kind`; sku único por tenant; validación Zod | S2-01 | done | specs/done/S2-02-productos.md |
| S2-03 | Como operario quiero registrar movimientos de stock (entrada/salida/ajuste) para mantener el inventario al día | RPC `register_movement`; invariante stock ≥ 0; pgTAP de invariantes | S2-02 | done | specs/done/S2-03-movimientos-stock.md |
| S2-04 | Como gerente quiero ver el stock actual por producto y bodega, y el kardex valorizado de cada producto, para conocer mi inventario | vista `current_stock` + vista `kardex` (promedio ponderado); listado con búsqueda y filtro por bodega | S2-03 | done | specs/S2-04-kardex.md |
| S2-05 | Como gerente quiero alertas de productos bajo stock mínimo para reponer a tiempo | indicador en listado + sección de alertas | S2-04 | done | specs/done/S2-05-alertas-stock.md |

## Épica E3 — Compras (Sprint 3)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S3-01 | Como admin quiero gestionar proveedores (con NIT) para registrar a quién compro | CRUD suppliers; RLS + aislamiento | S1-04 | done | specs/done/S3-01-proveedores.md |
| S3-02 | Como admin quiero crear órdenes de compra con ítems para registrar mis pedidos | purchases + purchase_items; totales calculados en BD; estados draft/ordered | S3-01, S2-02 | done | specs/done/S3-02-ordenes-compra.md |
| S3-03 | Como operario quiero recibir una compra para que el stock entre automáticamente | RPC `receive_purchase` atómica; pgTAP de atomicidad; no recibir dos veces | S3-02, S2-03 | done | specs/done/S3-03-recepcion-compra.md |
| S3-04 | Como admin quiero cancelar o corregir una orden no recibida para reflejar la realidad | transiciones de estado válidas; orden recibida no se cancela | S3-03 | done | specs/done/S3-04-cancelacion-compra.md |

## Épica E4 — Pagos a proveedores y cuentas por pagar (Sprint 4)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S4-01 | Como admin quiero registrar pagos a proveedores para llevar mis cuentas | RPC `register_supplier_payment`; invariante pago ≤ saldo; pgTAP | S3-03 | done | specs/done/S4-01-pagos-proveedores.md |
| S4-02 | Como gerente quiero ver cuentas por pagar y saldos por proveedor para planear mi caja | vista `supplier_balances`; detalle por proveedor con compras y pagos | S4-01 | done | specs/done/S4-02-cuentas-por-pagar.md |

## Épica E5 — Clientes, ventas y POS (Sprint 5)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S5-01 | Como admin quiero gestionar clientes (documento, contacto) para saber a quién vendo | CRUD customers; RLS + aislamiento | S1-04 | done | specs/done/S5-01-clientes.md |
| S5-02 | Como vendedor quiero crear ventas con ítems (borrador) para registrar pedidos de clientes | sales + sale_items; totales calculados en BD; cliente opcional (mostrador) | S5-01, S2-02 | done | specs/done/S5-02-ventas-borrador.md |
| S5-03 | Como vendedor quiero confirmar una venta para que el stock salga y el costo quede congelado | RPC `confirm_sale` atómica; invariantes stock ≥ 0 y no confirmar dos veces; congela costo promedio en `sale_items.unit_cost`; pgTAP | S5-02, S2-03 | done | specs/done/S5-03-confirmacion-venta.md |
| S5-04 | Como admin quiero registrar pagos de clientes para llevar cuentas por cobrar | RPC `register_customer_payment`; invariante pago ≤ saldo; vista `customer_balances`; pgTAP | S5-03 | done | specs/done/S5-04-pagos-clientes.md |
| S5-05 | Como gerente quiero ver el historial CRM de cada cliente (compras, frecuencia, ticket promedio) para conocer y fidelizar | vista `customer_history`; ficha de cliente con línea de tiempo de ventas y pagos | S5-04 | done | specs/done/S5-05-historial-crm.md |
| S5-06 | Como vendedor quiero marcar una venta como despachada y entregada, con su dirección de envío, para trazar la entrega | estados shipped/delivered + shipping_address/shipped_at/delivered_at; transiciones válidas garantizadas en BD y probadas en pgTAP; despachada no se cancela | S5-03 | done | specs/done/S5-06-despacho-entrega.md |
| S5-07 | Como admin quiero registrar interacciones postventa (seguimiento, reclamo, promoción) para cerrar el ciclo CRM | CRUD `customer_interactions`; línea de tiempo en la ficha del cliente; RLS + aislamiento | S5-05 | done | specs/done/S5-07-interacciones-crm.md |
| S5-08 | Como vendedor quiero descuentos por ítem y numeración consecutiva de recibos para vender con trazabilidad | `sale_items.discount` (precio de lista intacto); `receipt_number` consecutivo por tenant asignado en RPC; pgTAP del consecutivo sin huecos ni duplicados | S5-03 | done | specs/done/S5-08-descuentos-consecutivo.md |
| S5-09 | Como cajero quiero abrir y cerrar caja con arqueo para controlar el efectivo del turno | tabla `cash_sessions`; RPCs `open_cash_session`/`close_cash_session`; invariantes: una sesión abierta por usuario, no cerrar dos veces; vista `cash_session_summary`; pgTAP | S5-03 | done | specs/done/S5-09-caja-arqueo.md |
| S5-10 | Como cajero quiero una pantalla POS de venta rápida para cobrar en un solo paso | RPC `register_pos_sale` atómica (ítems + descuentos + consecutivo + stock + pagos mixtos + sesión); invariantes: sesión abierta, Σ pagos = total, stock ≥ 0; UI ágil con `miel-design` | S5-08, S5-09 | done | specs/done/S5-10-pos-venta-rapida.md |

## Épica E6 — Producción (Sprint 6)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S6-01 | Como admin quiero definir recetas opcionales por producto terminado para estandarizar mi proceso | CRUD recipe_items; solo productos `finished` tienen receta; RLS + aislamiento | S2-02 | done | specs/done/S6-01-recetas.md |
| S6-02 | Como operario quiero registrar una producción (consumo de insumos → entrada de terminado) para procesar materias primas | RPC `register_production` atómica; costo del terminado = Σ consumos / output_qty; receta pre-llena consumos editables; pgTAP de invariantes y atomicidad | S6-01, S2-03 | done | specs/done/S6-02-registro-produccion.md |

## Épica E7 — Gastos y finanzas (Sprint 7)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S7-01 | Como admin quiero registrar gastos generales clasificados como fijos o variables para completar mis egresos | CRUD expenses con `kind` (fixed/variable) y categoría; RLS + aislamiento | S1-04 | done | specs/done/S7-01-gastos-generales.md |
| S7-02 | Como gerente quiero ver P&L mensual, flujo de caja y rentabilidad por producto para conocer mis ganancias | vistas `monthly_pnl`, `cash_flow`, `product_profitability`, `monthly_expenses`; COGS desde costos congelados | S5-03, S7-01 | done | specs/done/S7-02-finanzas.md |
| S7-03 | Como gerente quiero una página de Finanzas con gráficas de mis gastos y ganancias para detectar fugas y oportunidades | gráficas: evolución por categoría, fijo vs variable, % de gastos sobre ingresos, comparativa mensual, reporte de descuentos otorgados; UI con `miel-design` + skill `dataviz` | S7-02 | done | specs/done/S7-03-finanzas-graficas.md |

## Épica E8 — Dashboard gerencial (Sprint 8)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S8-01 | Como gerente quiero un dashboard con ventas del mes, utilidad, valor de inventario, CxC y CxP para decidir informado | tarjetas resumen con métricas agregadas y enlace a la página Finanzas (sin gráficas profundas); consultas eficientes | S2-04, S4-02, S7-02 | done | specs/done/S8-01-dashboard-gerencial.md |
| S8-02 | Como gerente quiero top de productos vendidos y más rentables, y alertas de stock, en el dashboard para actuar rápido | top 10 vendidos y por margen; menos vendidos; alertas bajo mínimo; enlaces a módulos | S8-01 | done | specs/done/S8-02-dashboard-top-alertas.md |

## Épica E9 — Hardening y beta (Sprint 9)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S9-01 | Como equipo queremos e2e de humo (login → producto → movimiento → venta → despacho) para proteger el flujo core | Playwright verde en CI | S5-06 | done | specs/done/S9-01-e2e-playwright.md |
| S9-02 | Como equipo queremos seeds de demo para mostrar el producto a prospectos | script con service_role fuera de src/; datos realistas (compras, producción, ventas, interacciones CRM) | S2-04, S3-03, S5-03, S6-02, S7-01 | done | specs/done/S9-02-seeds-demo.md |
| S9-03 | Como fundador quiero deploy en Vercel + Supabase cloud para invitar beta testers | proyecto cloud; migraciones aplicadas; env vars; checklist pausa free-tier | todas | done | specs/done/S9-03-deploy-cloud.md |
| S9-04 | Como fundador quiero una auditoría de seguridad pre-beta para salir con el estándar cumplido | revisar `docs/arch/seguridad.md` contra el código real (headers CSP activos, Zod en boundaries, errores genéricos); prueba manual de open redirect; `npm audit` limpio | S9-01 | done | specs/done/S9-04-auditoria-seguridad.md |

## Épica E10 — Gobernanza mobile-first (sin sprint asignado aún)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S10-01 | Como usuario móvil quiero que la navegación de la app colapse a un drawer para no perder ancho de contenido en pantallas pequeñas | sidebar de `src/app/(app)/layout.tsx` colapsa a `Sheet`/drawer con disparador (hamburguesa) bajo `md`; sin scroll horizontal a 375px; `npx shadcn add sheet`; quitar el `test.fixme` de `e2e/responsive.spec.ts` (bloque autenticado) al cerrar | ADR-025 | todo | — |
| S10-02 | Como visitante quiero una landing clara y atractiva que me explique qué es Miel y me invite a crear una cuenta gratis en la beta | secciones hero/mockup 3D CSS/beneficios/cómo funciona/CTA/footer; "Gratis durante la beta" visible, sin precios; CTAs a `/signup` y `/login`; SEO + OG image; cero dependencias nuevas; sin overflow a 375px; reduced-motion respetado | ADR-025 | done | specs/done/S10-02-landing-publica-v2.md |

## Épica E11 — Mejoras post-beta (sin sprint asignado aún)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S11-01 | Como fundador quiero que un usuario solo pueda crear 1 empresa como owner (multiempresa solo vía invitación) para evitar empresas de prueba/duplicadas y confusión de contexto | check en `create_tenant_with_owner` (P0001) + pgTAP; link "+ Crear otra empresa" y `?crear` solo para usuarios sin membership owner; ADR-026 — **superada en parte por S14-04/ADR-031**: la invariante ya no distingue owner/invitado, cualquier membership previa bloquea la creación | S1-03, S1-05 | done | specs/done/S11-01-limite-un-owner.md |
| S11-02 | Como usuario móvil quiero ver el nombre de la empresa activa en el header para saber siempre en qué empresa estoy trabajando | nombre del tenant activo visible en el header móvil de `(app)/layout.tsx`; sin overflow a 375px (ADR-025) | S1-04 | todo | — |
| S11-03 | Como usuario quiero poder ver la contraseña que escribo en login/registro/reset para evitar errores de tipeo | componente `PasswordInput` con toggle ojo/ojo-tachado (`lucide-react`); alterna `type` text/password; accesible (`aria-label`, `aria-pressed`, `type="button"`); no rompe `name="password"` ni selectores E2E | S1-02 | done | specs/done/S11-03-toggle-password.md |
| S11-04 | Como usuario quiero que al fallar el login/registro no se borre mi correo para no tener que reescribirlo | `AuthState` devuelve `email` en la rama de error de login/signup/forgot-password; formularios repueblan el campo con `defaultValue`; contraseña nunca se devuelve al cliente | S1-02 | done | specs/done/S11-04-preservar-email.md |
| S11-05 | Como dueño de PYME quiero que el menú lateral esté ordenado por cómo opero el negocio a diario para encontrar cada sección sin pensar | `NAV_ITEMS` reordenado (Inicio, Vender, Comprar, Inventario, Gastos · Producción, Finanzas, Equipo) con divisor entre grupos; Ventas→Vender y Compras→Comprar solo como label (rutas intactas); se elimina `/dashboard` (placeholder huérfano, ADR-027); cada página índice explica su sección en el encabezado | S1-04 | done | specs/done/S11-05-orden-menu-lateral.md |

## Épica E12 — Desbloquear la operación (bugs reportados por usuarios)

Origen: backlog de usuarios en Notion ("MIEL – ERP (Backlog)"), triage 2026-08-15. Objetivo del
ciclo: que un negocio real pueda operar sin trabarse — estas 4 historias van primero.

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S12-01 | Como comprador quiero registrar que un pedido llegó para que el stock y las cuentas por pagar reflejen la realidad | botón "Recibir" + selector de bodega en `/compras/ordenes` invoca `receive_purchase` (ya existe y está testeada, `20260720143947_receive-purchase.sql`); botón "Cancelar" invoca `cancel_purchase`; botón "Editar" invoca `update_purchase`; vista de detalle de ítems de una orden | S3-03 | done | specs/done/S12-01-gestion-ordenes-compra.md |
| S12-02 | Como usuario quiero ver siempre la hora de Colombia para que las fechas de caja, compras, ventas y gastos sean correctas | helper `src/lib/format.ts` (`formatDateTime`/`formatMoney`) con `timeZone: "America/Bogota"`; reemplaza los ~20 usos ad-hoc de `toLocaleString`/`Intl.DateTimeFormat` sin timezone; corrige el `datetime-local` de `gastos/expense-form.tsx` que hoy desplaza la hora a UTC | — | done | specs/done/S12-02-timezone-colombia.md |
| S12-03 | Como owner quiero que la invitación llegue por correo para no tener que copiar y pegar el link a mano | SMTP configurado en `supabase/config.toml` o integración Resend (ADR de dependencia nueva); aviso en la UI de invitación de que el invitado debe registrarse con ese mismo correo | S1-05 | done | specs/done/S12-03-invitacion-por-correo.md |
| S12-04 | Como usuario con más de una empresa quiero que la caja se abra en la empresa que tengo activa, no en la primera que encuentre el sistema | `open_cash_session` recibe `p_tenant_id` explícito en vez de `limit 1` sobre `memberships` (hoy puede abrir caja en el tenant equivocado); migración forward-only + pgTAP de regresión | S5-08 | done | specs/done/S12-04-caja-tenant-activo.md |
| S12-05 | Como cajero quiero ver el precio de venta y el IVA de cada producto en el POS para poder cobrar | `/ventas/pos` lee `products_catalog` (no la tabla base `products`, que revienta con 42501 para `price`/`tax_rate`); la vista deja de enmascarar `price`/`tax_rate` para `member` (ADR-029), solo `cost` sigue oculto; pgTAP de regresión | S2-02, S5-10 | done | specs/done/S12-05-precio-visible-member.md |

## Épica E13 — Un solo camino para el inventario

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S13-01 | Como dueño quiero un único flujo para dar de alta un producto con su stock inicial para no confundirme entre "+ Ingresar stock manual" y "Productos" | unifica los 3 formularios casi idénticos (`inventario/manual-movement-form.tsx`, `productos/product-form.tsx`, `kardex/[productId]/movement-form.tsx`) en un solo camino que crea producto y movimiento inicial en la misma operación | S2-01, S2-02 | done | specs/done/S13-01-alta-producto-con-stock.md |
| S13-02 | Como dueño quiero editar o archivar un producto sin que el formulario se vea roto para confiar en la herramienta | formulario de edición deja de inyectarse en `<tr><td colSpan={6}>` (`productos/product-row.tsx`); usa el mismo layout de ancho completo que la creación | S2-01 | done | specs/done/S13-02-editar-archivar-producto.md |
| S13-03 | Como dueño quiero poder registrar salidas y ajustes de stock, no solo entradas, para corregir errores de cantidad o costo | la UI deja de hardcodear `kind="in"`; expone `out`/`adjust` (el RPC `register_movement` y el Zod ya los aceptan) | S2-02 | done | specs/done/S13-03-salidas-ajustes-stock.md |

## Épica E14 — Navegación y Home simple

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S14-01 | Como dueño quiero no ver Finanzas ni Producción en el menú por ahora para no distraerme con módulos que no uso | se ocultan de `NAV_ITEMS`; código y rutas intactos (reversible en una línea); se retira el `separatorBefore` de S11-05 (el grupo de gestión queda solo con Equipo) | S11-05 | done | specs/done/S14-01-ocultar-modulos.md |
| S14-02 | Como dueño quiero que Inicio muestre primero los módulos y accesos directos, y el resumen gerencial más abajo | `inicio/page.tsx` reordena: módulos/accesos directos ("Vender", "Agregar al inventario") arriba, `DashboardMetricsCards`/`DashboardInsights` abajo | S8-01, S8-02 | done | specs/done/S14-02-inicio-modulos-primero.md |
| S14-03 | Como usuario quiero que el logo/nombre "Miel" sea un link a Inicio para volver rápido desde cualquier pantalla | `Logo`/texto "Miel" en `(app)/layout.tsx` envuelto en `<Link href="/inicio">` | S1-04 | done | specs/done/S14-03-logo-link-inicio.md |
| S14-04 | Como usuario quiero que la empresa se funde solo al registrarme para no confundirme con una opción de creación que no debería tener estando ya invitado a otra | `TenantSwitcher` ya se ocultaba con 1 membership (sin cambios); se retira el link "+ Crear mi empresa"/`?onboarding=crear` y `create_tenant_with_owner` rechaza a cualquier usuario con membership previa, no solo a un owner (ADR-031, supersede ese punto de ADR-026) | ADR-026 | done | specs/done/S14-04-empresa-solo-en-registro.md |
| S14-05 | Como usuario quiero entender qué hace "Abrir caja" para operarla con confianza | texto de ayuda en `/ventas/caja` explicando qué es el monto de apertura y qué pasa al cerrar | S5-08 | done | specs/done/S14-05-ayuda-abrir-caja.md |
| S14-06 | Como dueño quiero que los accesos directos de Inicio lleven a la raíz del módulo en vez de saltar directo a una acción | "Vender" → `/ventas` (antes `/ventas/pos`), "Agregar al inventario" → `/inventario` (antes `/inventario/productos`) en `inicio/quick-actions.tsx` — **superada por S14-07** (el componente se elimina) | S14-02 | done | specs/done/S14-06-accesos-directos-a-modulo.md |
| S14-07 | Como dueño quiero que Inicio muestre solo Módulos y Resumen gerencial, sin accesos directos duplicados | se elimina `inicio/quick-actions.tsx` (y su test) y su uso en `inicio/page.tsx`; las acciones equivalentes ya viven dentro de cada módulo ("Punto de Venta" en `/ventas`, "+ Nuevo producto" en `/inventario`, ambos preexistentes) | S14-02, S14-06 | done | specs/done/S14-07-quitar-accesos-directos-inicio.md |

## Épica E15 — Compras y clientes completos

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S15-01 | Como comprador quiero ver qué le compro a cada proveedor para no tener que revisar todo el catálogo al armar una orden | tabla nueva `supplier_products` (RLS + test de aislamiento) relaciona proveedor↔producto; `compras/ordenes/purchase-form.tsx` sugiere primero los productos del proveedor elegido, con opción de ver todo el catálogo | S3-01, S3-02 | done | specs/done/S15-01-catalogo-por-proveedor.md |
| S15-02 | Como vendedor quiero dar de alta un cliente rápido desde el punto de venta para no perder la venta por ir a otro módulo | modal de alta rápida en `/ventas/pos` reutiliza `createCustomer`; se habilita para rol `member` (hoy solo owner/admin pueden crear clientes) | S5-01 | done | specs/done/S15-02-alta-rapida-cliente-pos.md |

## Épica E16 — Inventario avanzado y reportes

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S16-01 | Como dueño quiero trasladar stock entre bodegas de forma atómica para no perder trazabilidad al mover mercancía | RPC nueva (`transfer_stock` o similar) + `kind='transfer'` en el CHECK de `stock_movements`; UI en `/inventario`; pgTAP que verifique que no queda stock huérfano si falla a mitad de camino | S2-02 | todo | — |
| S16-02 | Como usuario quiero que "Bodegas" se llame "Sedes" en toda la app para que el término coincida con cómo pienso mi negocio | rename de copy en ~25 archivos (label, títulos, empty states, mensajes de error); la tabla `warehouses` y la ruta `/inventario/bodegas` no cambian (sin valor en un rename de esquema forward-only) | S2-02 | todo | — |
| S16-03 | Como dueño quiero imprimir un extracto mensual de mi negocio para revisarlo o compartirlo | vista imprimible (`@media print`) sobre las vistas ya existentes (`monthly_pnl`, `cash_flow`, `kardex`); sin dependencias nuevas de PDF/export | S7-02, S8-01 | todo | — |

## Épica E17 — Modelo de roles ampliado

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S17-01 | Como owner quiero asignar roles de Dueño/Vendedor/Comprador/Observador para que cada persona del equipo solo vea y haga lo que le corresponde | ADR que supersede ADR-018/019; migración de los 2 CHECK de rol; reemplaza el patrón `role !== "member"` (15 archivos, incluido `nav-visibility.ts`) por capabilities en `src/lib/tenant/`; actualiza los 30 tests pgTAP que mencionan roles | S1-05 | todo | — |

## Épica E18 — Simplificar Ventas (vender rápido, para alguien con poca capacitación)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S18-01 | Como empleado quiero abrir la caja sin salir de la pantalla de Vender para no perder tiempo saltando de página | `ventas/pos/page.tsx` muestra el formulario real de apertura (`OpenSessionForm` reusado) en vez de un link a `/ventas/caja`; `openCashSession` revalida también `/ventas/pos` | S5-08 | done | specs/done/S18-01-abrir-caja-inline-en-vender.md |
| S18-02 | Como dueño quiero registrar quién era el encargado al abrir/cerrar caja (desplegable con los miembros de la empresa), sin exigir una aprobación aparte por ahora | pendiente de definir — campo informativo, no un flujo de aprobación; el humano dijo "luego trabajaremos en eso" | S18-01 | todo | — |
| S18-03 | Como dueño quiero que Ventas tenga solo 4 accesos (Clientes, Sucursal, Cuentas por cobrar, Inicio) y que Pedidos/Caja/Punto de Venta queden agrupados dentro de "Sucursal" | `ventas/page.tsx` reducido a 4 links; nueva `ventas/sucursal/page.tsx` con los 3 accesos que salieron de la raíz (mismas URLs, sin cambios internos) | S18-01 | done | specs/done/S18-03-agrupar-sucursal-en-ventas.md |
| S18-04 | Como dueño quiero que Ventas no tenga botón "Inicio" (ya se vuelve por el logo del sidebar) | `ventas/page.tsx` queda con 3 accesos: Clientes, Sucursal, Cuentas por cobrar | S18-03 | done | specs/done/S18-04-quitar-inicio-de-ventas.md |
| S18-05 | Como dueño quiero deshacer la agrupación "Sucursal": Pedidos/Caja/POS vuelven a ser accesos directos en Ventas | `ventas/page.tsx` con Pedidos/Caja/POS de vuelta en la raíz (gateados por `sellsPhysical`); se borra `ventas/sucursal/page.tsx` | S18-04, S19-01 | done | specs/done/S18-05-revertir-agrupacion-sucursal.md |

## Épica E19 — Canal de venta física y/o virtual (combinables)

| ID | Historia | Criterios clave | Depende de | Estado | Spec |
|---|---|---|---|---|---|
| S19-01 | Como dueño quiero que Miel me pregunte si vendo de forma física, virtual o ambas, y que Ventas oculte Sucursal cuando no vendo físico | `tenants.sells_physical`/`sells_virtual` (booleanos combinables, `CHECK` al menos uno true); onboarding pregunta con 2 checkboxes; `/ventas` oculta Sucursal sin canal físico y muestra "Catálogo" con canal virtual | S1-03 | done | specs/done/S19-01-canal-de-venta-fisica-virtual.md |
| S19-02 | Como dueño quiero generar productos de catálogo (foto, descripción, precio, descuento) desde un botón "Generar producto" en `/ventas/catalogo` | `products` gana `photo_url`/`discount_percent`; bucket Storage `product-photos` (público en lectura, escritura admin-only por tenant); alta simplificada sin SKU/costo/IVA manual (autogenerado); grid de tarjetas con precio tachado si hay descuento | S19-01 | done (migración aplicada y confirmada 2026-09-28) | specs/done/S19-02-catalogo-productos.md |
| S19-03 | Como dueño quiero editar y eliminar un producto directamente desde `/ventas/catalogo` | Botones "Editar"/"Eliminar" por tarjeta (solo owner/admin); edición reusa los mismos campos del alta; "Eliminar" reusa `toggleProductActive` (soft-delete, active=false), no DELETE físico | S19-02 | done | specs/done/S19-03-editar-eliminar-catalogo.md |
| S19-04 | Como dueño quiero que el catálogo permita ver los precios convertidos a otra moneda (p. ej. COP→EUR para un comprador europeo) | Selector de moneda en `/ventas/catalogo`; `getExchangeRate` (Server Action, API pública `open.er-api.com`, cacheada 1h) hace la conversión de VISTA, sin persistir ni afectar `products.price`; `tenants.currency` (existía sin usar desde S1-01) ahora se expone como moneda base | S19-02 | implemented (código, depende de una API externa real — no verificable en este sandbox) | specs/done/S19-04-conversion-moneda-catalogo.md |
| S19-05 | Como dueño quiero marcar, al generar un producto, si se vende solo por internet, solo en tienda, o por ambas | `products.sales_channel` (`online`/`in_store`/`both`, default `both`); selector en el alta/edición del catálogo; badge de canal en la tarjeta; **corregido en la misma sesión**: `/ventas/catalogo` ya NO filtra por canal (es la vista de gestión, nunca esconde productos), solo `/ventas/pos`/`/ventas/pedidos` filtran a `in_store`/`both` | S19-02 | implemented (código); **migración sin aplicar al cloud, ver Deuda técnica** | specs/done/S19-05-canal-de-venta-por-producto.md |
| S19-06 | Como dueño quiero apretar un producto del catálogo y armar un Pedido (carrito) con cantidad y cliente asignado | Reusa `createSale`/`create_sale` (S5-02) tal cual, sin tabla ni RPC nueva; carrito en localStorage por tenant; arma el mismo payload de ítems que `SaleForm` y confirma con la misma acción | S19-02, S5-02 | done (sin migración, no bloqueado) | specs/done/S19-06-carrito-catalogo-a-pedido.md |
| S19-07 | Como dueño quiero que "Ver pedido" lleve a la página de Pedidos que ya existe, no a una ruta nueva | Se borra `/ventas/catalogo/pedido`; el carrito (`CatalogPedidoCart`) se muda dentro de `/ventas/pedidos`, arriba de `SaleForm`; sin carrito activo la página se ve igual que siempre; "Agregar al pedido" ya no navega (corrección de UX en la misma historia) | S19-06 | done (sin migración, no bloqueado) | specs/done/S19-07-unificar-pedido-en-ventas-pedidos.md |
| S19-08 | Como dueño quiero ver Subtotal/IVA/Total a pagar por separado en el pedido, y elegir forma de pago (efectivo/tarjeta/transferencia) | Verificado que no había bug de cálculo — se agregó el desglose visible; `sales.payment_method` nuevo (descriptivo, no transaccional, sin exigir caja ni cliente); `create_sale` lo acepta opcional; visible en el listado de Pedidos | S19-07 | implemented (código); **migración sin aplicar al cloud, ver Deuda técnica** | specs/done/S19-08-desglose-y-forma-de-pago-pedido.md |
| S19-09 | Como dueño quiero un cliente genérico real (no `customer_id = null`) cuando no se elige cliente en una venta | `customers.is_generic` (uno por tenant, índice único parcial); `getOrCreateGenericCustomerId` compartido entre `createSale` (Pedidos) y `registerPosSale` (POS); desbloquea "Registrar cobro" para ventas de mostrador (antes exigía `customer_id` no nulo) | S5-02 | implemented (código); **migración sin aplicar al cloud, ver Deuda técnica** | specs/done/S19-09-cliente-generico.md |
| S19-10 | Como dueño quiero que el IVA del catálogo salga en 19% (estándar del país), no en 0 | `createCatalogProduct` usaba `tax_rate: 0` por un supuesto incorrecto de S19-02; corregido a `DEFAULT_TAX_RATE_PERCENT = 19` (mismo default que ya usa `products.tax_rate` y el formulario de inventario); backfill de los productos `CAT-%` ya creados con 0 | S19-02 | implemented (código); **migración sin aplicar al cloud, ver Deuda técnica** | specs/done/S19-10-iva-default-catalogo.md |
| S19-11 | Como dueño quiero que el Pedido refresque precio/descuento/IVA del carrito contra la BD al abrirse, no una foto vieja | `refreshCartProductData` (Server Action) + `updateLineData` en `useCatalogCart`; `CatalogPedidoCart` reconcilia una vez al entrar (sin pisar cantidades elegidas ni loopear con `lines` como dependencia) | S19-06 | done (sin migración, no bloqueado) | specs/done/S19-11-refrescar-carrito-al-abrir-pedido.md |
| S19-12 | Como dueño quiero un botón "Volver" en todas las páginas | `BackButton` (`router.back()`) agregado una sola vez en el layout compartido de `(app)`, arriba de `{children}` — no en cada página; oculto en `/inicio` | — | done (sin migración, no bloqueado) | specs/done/S19-12-boton-volver.md |
| S19-13 | Como dueño quiero ver en qué bodega/sucursal está un producto del catálogo y su stock total en todas | Reusa `current_stock` (vista existente de `stock_movements`, S2-03) — sin esquema nuevo; `catalogo/page.tsx` la consulta junto con `warehouses` y arma el desglose por tarjeta | S19-02, S2-01, S2-03 | done (sin migración, no bloqueado) | specs/done/S19-13-stock-por-bodega-en-catalogo.md |
| S19-14 | Como dueño quiero poder cargar/agregar stock y elegir bodega/sucursal/tienda desde el alta y edición del catálogo (S19-13 era de solo lectura) | Reusa `register_movement` (RPC de S2-03/S13-01) — sin RPC nueva; bloque "Stock" opcional en `CatalogProductFields`, bodega+cantidad; alta y edición del catálogo pueden sumar stock | S19-13 | done (sin migración, no bloqueado) | specs/done/S19-14-stock-y-bodega-en-formulario-catalogo.md |
| S19-15 | Como dueño quiero asignar un producto a una categoría (creable desde el producto o aparte) y filtrar el catálogo por categoría | Tabla `product_categories` + `products.category_id`; botón "Generar categoría" arriba de "Generar producto"; selector de categoría + "o creá una nueva" en el alta/edición; filtro "Todos" + un botón por categoría en `/ventas/catalogo` (`?categoria=<id>`) | S19-02 | implemented (código); **migración sin aplicar al cloud, ver Deuda técnica** | specs/done/S19-15-categorias-de-producto.md |
| S19-16 | Como dueño quiero crear una categoría con un "+" junto al selector (modal), sin botón suelto ni campo "o creá una nueva" | Se borran `CatalogCategoryForm`, `new_category_name` y `getOrCreateCategoryId`; `CategoryPicker` con `Dialog` sin `<form>` anidado; `createCategory(name)` devuelve la categoría y queda seleccionada | S19-15 | done (sin migración) | specs/done/S19-16-categoria-desde-modal.md |
| S19-17 | Como dueño quiero ver el stock total del producto (solo lectura) en el listado y al editar | `totalStockByProduct` (`src/lib/stock.ts`) sobre `current_stock`; columna "Stock" en `/inventario/productos`; "Stock total" en la edición de Inventario y del Catálogo | S19-13 | done (sin migración) | specs/done/S19-17-stock-total-producto.md |
| S19-18 | Como dueño quiero una bodega o sucursal "Principal" siempre presente, con dirección/departamento/ciudad/país/código postal/teléfono/WhatsApp | `warehouses.is_default` + 7 columnas; única por empresa, no archivable, `is_default` no escribible (grants por columna); `create_tenant_with_owner` la crea y backfill para existentes; restaura invariante S14-04 perdida en S19-01 | S2-01, S19-01 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-18-bodega-principal.md |
| S19-19 | Como dueño quiero que donde diga "Bodega" diga "Bodega o sucursal" | Solo texto visible (labels, placeholders, títulos, mensajes de error); rutas/tablas sin cambios | S2-01 | done (sin migración) | specs/done/S19-19-etiqueta-bodega-o-sucursal.md |
| S19-20 | Como dueño quiero que el stock del producto en el catálogo venga solo de las bodegas o sucursales, sin poder modificarlo ahí | Se quita la carga de stock de S19-14 del formulario del catálogo; la edición muestra total + desglose por bodega o sucursal | S19-14, S19-17 | done (sin migración) | specs/done/S19-20-stock-solo-lectura-catalogo.md |
| S19-21 | Como dueño quiero un botón "Categorías" junto a "Generar producto" para crear, renombrar y eliminar categorías, unido al "+" del producto | Políticas RLS update/delete en `product_categories`; `renameCategory`/`deleteCategory`; `CategoryManager` compartido por el botón y el "+" | S19-15, S19-16 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-21-gestionar-categorias.md |
| S19-22 | Como dueño quiero que los productos que se venden en tienda solo generen boleta con la caja abierta (el pedido sí se puede crear) | `confirm_sale` exige caja abierta de quien confirma si hay productos `in_store`/`both` (`cash_session_required`) y liga la venta a la caja; aviso en Pedidos | S5-03, S5-09, S19-05 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-22-boleta-requiere-caja.md |
| S19-23 | Como dueño quiero eliminar por completo el Punto de Venta | Se borran `/ventas/pos`, sus actions/validación/tests y la RPC `register_pos_sale` (migración); ventas en tienda por Pedidos + boleta con caja | S19-22 | implemented (código); **migración sin aplicar al cloud** | specs/done/S19-23-eliminar-punto-de-venta.md |
| S19-24 | Como dueño quiero un solo producto y un solo formulario en Productos (inventario) y Catálogo, con unidad/tipo/stock mínimo/costo/precio, SKU automático o manual, IVA editable y categorías en ambos | `productSchema`/`createProduct`/`updateProduct` únicos; componentes en `src/components/products/`; `/inventario/productos` con la misma grilla del Catálogo; Catálogo sin materia prima | S19-20, S19-21 | done (sin migración) | specs/done/S19-24-formulario-unico-producto.md |
| S19-25 | Como dueño quiero ver la bodega principal con todos sus datos, crear otras aparte, editarlas/eliminarlas, y reactivar productos eliminados | `PrincipalForm` relleno + `WarehouseForm` toggle + filas con Editar/Eliminar/Reactivar; "Productos eliminados" con Reactivar en `/inventario/productos` | S19-18, S19-24 | done (sin migración) | specs/done/S19-25-bodega-principal-visible-y-reactivar.md |
| S19-26 | Como dueño quiero un inventario por tipo (productos, materias primas, artículos de oficina, mobiliario, vehículos, herramientas, aseo), cada uno con su botón y su CRUD, y datos propios de vehículos/mobiliario | `products.inventory` + campos de activo; `src/lib/inventories.ts`; `InventoryView` compartida; grilla de inventarios en `/inventario` | S19-24 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-26-tipos-de-inventario.md |
| S19-27 | Como dueño quiero ver en Alertas todo lo que llegó a su stock mínimo, con foto, y armar una orden de compra desde ahí | Tarjetas con foto + selección → `/compras/ordenes?desde=` precarga ítems con cantidad sugerida | S19-26 | done (sin migración propia; depende de S19-26 aplicada) | specs/done/S19-27-alertas-con-orden-de-compra.md |
| S19-28 | Como dueño quiero que cada inventario tenga sus propias categorías, sin mezclarse | `product_categories.inventory`, único por inventario, reparto de lo existente, trigger de coherencia ítem↔categoría | S19-26 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-28-categorias-por-inventario.md |
| S19-29 | Como dueño quiero en Alertas un botón por inventario y, dentro, lo que está bajo el mínimo para crear la orden de compra | `/inventario/alertas?inventario=<slug>` con conteo por inventario | S19-27 | done (sin migración) | specs/done/S19-29-alertas-por-inventario.md |
| S19-30 | Como dueño quiero quitar el botón "Registrar movimiento de stock" de Inventario | Se quita `StockMovementForm` de `/inventario` (el kardex por producto conserva el suyo) | — | done (sin migración) | — (cambio de UI de una línea, sin spec) |
| S19-31 | Como dueño quiero el menú en el orden Inicio, Vender, Inventario, Comprar, Gastos, RRHH | Reordena `NAV_ITEMS`; "Equipo" pasa a llamarse "RRHH" (ruta `/equipo` sin cambios) | — | done (sin migración) | — (cambio de menú, sin spec) |
| S19-32 | Como dueño quiero ver el stock de cada bodega o sucursal en el producto, editable (junto con el stock mínimo) solo en Inventario y de solo lectura en Vender | RPC `set_product_stock` (ajustes en kardex, atómica); `ProductFields` con `mode` inventory/sales y grilla alineada | S19-24, S19-26 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-32-stock-por-bodega-en-producto.md |
| S19-33 | Como dueño quiero que "Volver" suba a la sección de arriba, no a la última pantalla abierta | `parentPath` (salta ids y segmentos sin página; módulo → /inicio); `BackButton` con Link en vez de `router.back()` | S19-12 | done (sin migración) | — (fix de navegación con tests, sin spec) |
| S19-34 | Como dueño quiero el historial de stock dentro de cada inventario, por bodega y rango de fechas, y un % de venta sobre el costo que calcule el precio | RPC `inventory_history`; `InventoryHistory` (botón Historial, GET); `PriceFields` costo/%/precio; formulario ordenado en pares | S19-26, S19-32 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-34-historial-y-porcentaje-de-venta.md |
| S19-35 | Como dueño quiero elegir la forma de entrega en el pedido (retiro, envío gratis, acordado, transporte por peso y km) antes del pago | `shipping_rates` + `/ventas/envios`; `products.weight_kg`; `create_sale` calcula el envío; carrito con sección de entrega y total con envío | S19-06, S19-08 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-35-formas-de-entrega.md |
| S19-36 | Como dueño quiero que Pedidos sea la hoja de venta: sin pedido manual, con botón "Crear cliente", solo pedidos por completar, y el historial de compras en la hoja del cliente | Se borra `SaleForm`; `isPendingSale` filtra Pedidos; tabla "Historial de compras" en `/ventas/clientes/[id]`; Catálogo siempre visible en Vender; e2e paso 7 vía catálogo | S19-35 | done (sin migración) | — (reorganización de UI con tests, sin spec) |
| S19-37 | Como dueño quiero Comprar como hoja de compra: proveedor con +, líneas con foto y costos con IVA, costo con IVA como costo del producto, e historial con fechas y proveedor | `receive_purchase` fija `products.cost` = costo con IVA; `/compras` con formulario, órdenes por recibir e Historial; `quickCreateSupplier` | S19-27, S19-34 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S19-37-hoja-de-compra.md |

## Épica E20 — Internacionalización (español/inglés/francés), TODA la app

**Pedido por el humano 2026-09-28, confirmado alcance completo** (no solo el catálogo — también
Inventario, Compras, Finanzas, todo módulo existente). **Sin empezar todavía** — es un cambio de
magnitud distinta al resto del backlog: no es una historia, es un proyecto propio que necesita su
propia sesión de planificación (spec + ADR de arquitectura) antes de tocar código, según el propio
protocolo SDD+TDD de este repo.

**Por qué no se arrancó en la sesión donde se pidió:** decenas de páginas y componentes con texto
en español hardcodeado, mensajes de error de cada Server Action/RPC, validaciones Zod, formateo de
fecha/moneda (`src/lib/format.ts` fija `es-CO`/`America/Bogota`), y ninguna infraestructura de
i18n todavía (`next-intl` u otra no está instalada). Intentarlo de apuro al final de una sesión ya
larguísima habría producido algo a medio hacer.

**Plan sugerido para la próxima sesión que la tome (no decidido/aprobado todavía, punto de
partida):**
1. ADR de arquitectura: librería (`next-intl` es el estándar para App Router), esquema de rutas
   (`/[locale]/...` con prefijo o negociación por header/cookie sin prefijo — decisión con
   impacto real en cada link/redirect existente), y si el selector de idioma es por
   usuario/tenant o por sesión de navegador.
2. Extraer strings a archivos de traducción módulo por módulo (no todo de una vez) — probablemente
   empezando por Ventas/Catálogo (el módulo más nuevo y más chico) como piloto antes de encarar
   Inventario/Compras/Finanzas.
3. `src/lib/format.ts` deja de fijar `es-CO`/`America/Bogota` — pasa a tomar el locale activo.
4. Mensajes de error de Server Actions/RPC (los `mapXError` de cada `actions/*.ts`) también
   necesitan traducirse — hoy son strings en español hardcodeados en el código, no datos.

**Siguiente paso:** el humano decide cuándo dedicarle una sesión a esto; empieza por el ADR, no
por código.

## Épica E21 — RRHH: personal y nómina (motor copiado de Gestion-Future, ADR-036)

Pedido por el humano 2026-09-29: traer a RRHH la contratación de personal y el pago de nóminas de
su proyecto Gestion-Future, como copia (sin quedar unidos). Plan por partes: primero el motor de
cálculo (portable tal cual), después cada capa rehecha con el stack de Miel.

| ID | Historia | Criterio | Depende | Estado | Spec |
|---|---|---|---|---|---|
| S21-01 | Como dueño quiero que Miel tenga el motor de nómina de Gestion-Future (Colombia 2026, por horas, XML DIAN) | Copia de la lógica pura a `src/lib/rrhh/` + 56 tests Jest→Vitest en verde; sin vínculo con el original | — | done | specs/done/S21-01-motor-de-nomina.md |
| S21-02 | Como dueño quiero registrar a mis trabajadores y crear categorías que definen qué ve cada uno | `workers` + `worker_categories` (RLS owner/admin); `/equipo/trabajadores` y `/equipo/categorias` | S21-01 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S21-02-trabajadores-y-categorias.md |
| S21-03 | Como trabajador quiero entrar con mi usuario y código de 4 dígitos y ver solo lo de mi categoría | Correo con "Acceso" (Administrador/Cuenta de la tienda/categoría) + modo tienda con código (cookie firmada, bcrypt, bloqueo 5/15 min), menú y rutas por categoría; ADR-037 | S21-02 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr, requiere `MIEL_SESSION_SECRET`** | specs/done/S21-03-acceso-trabajadores.md |
| S21-04 | Como dueño quiero ver el uso (ingresos, intentos fallidos y acciones importantes de cada trabajador) y clasificar el pago del trabajador como gasto/costo fijo/variable | `activity_log` + `logActivity` en 7 acciones; `/equipo/uso`; `workers.cost_classification` | S21-03 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S21-04-control-de-uso.md |
| S21-05 | Como dueño quiero liquidar la nómina de un período con el motor, con licencias, verla y generar el XML DIAN | Licencias, períodos, liquidación por trabajador, datos DIAN, XML con CUNE y consecutivo | S21-02 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S21-05-nomina.md |
| S21-06 | Como dueño quiero que la nómina sume en Finanzas como gasto o costo, fijo o variable, según cada trabajador | Vista `monthly_payroll`; P&L, gastos por mes y flujo de caja la incluyen; resumen por clasificación en el período | S21-04, S21-05 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S21-06-nomina-en-finanzas.md |
| S21-06 | Contratación de profesionales, licencias/incapacidades, nómina electrónica DIAN, portal del trabajador | A priorizar con el humano | S21-05 | todo | — |

## Épica E22 — Gastos y estado de resultados

Pedido por el humano 2026-09-29: gastos sencillos y fiables (fijos/variables ya clasificados) que
alimenten un estado de resultados.

| ID | Historia | Criterio | Depende | Estado | Spec |
|---|---|---|---|---|---|
| S22-01 | Como dueño quiero anotar gastos en dos hojas (fijos y variables) eligiendo categorías ya clasificadas, y verlos en una tabla con Editar/Borrar | `expense_categories` + tipo impuesto por la categoría; `/gastos?tipo=` | S21-06 | implemented (código); **migración sin aplicar al cloud, pgTAP sin correr** | specs/done/S22-01-gastos-fijos-y-variables.md |
| S22-02 | Como dueño quiero ver el estado de resultados | Ingresos, costo de ventas, mano de obra, gastos fijos y variables, utilidad | S22-01 | todo | — |

## Deuda técnica (no bloqueante, sin historia propia — limpiar en sesión de mantenimiento)
- **S19-26, bloqueante hasta que se resuelva**: migración
  `20260929165506_tipos-de-inventario.sql` sin aplicar al cloud — sin ella fallan los
  inventarios, el Catálogo y Alertas (seleccionan columnas nuevas). Se pega tal cual desde
  `supabase/migrations/20260929165506_tipos-de-inventario.sql`.
- S19-26: inventarios personalizados por el usuario quedaron fuera (lista fija).
- **S22-01, bloqueante hasta que se resuelva**: migración `20260929212405_categorias-de-gasto.sql` sin aplicar — sin ella falla Gastos
  (tabla `expense_categories`).
- **S21-06 (aplicada 2026-09-29)**: migración `20260929210552_nomina-en-finanzas.sql` sin aplicar (no bloquea la app;
  Finanzas no incluye la nómina hasta aplicarla). Finanzas sigue oculto en el menú (S14-01).
- **S21-04 (aplicada 2026-09-29)**: migración `20260929205403_control-de-uso.sql` sin
  aplicar — sin ella fallan Trabajadores (columna `cost_classification`) y Control de uso; el
  registro de acciones falla en silencio (no rompe ventas ni cajas).
- **S21-03 (aplicada 2026-09-29)**: migración
  `20260929203354_acceso-trabajadores.sql` sin aplicar — sin ella fallan todas las pantallas
  (`getActiveTenant` lee `memberships.category_id`). Requiere `MIEL_SESSION_SECRET` en cada
  entorno (en `.env.local` ya se generó; reiniciar `npm run dev`).
- **S21-05 (aplicada 2026-09-29)**: migración `20260929200638_nomina.sql` sin aplicar
  — sin ella fallan Nómina, Licencias y Datos DIAN. El XML DIAN se genera pero no se firma ni se
  envía (falta firma digital y conexión al servicio de la DIAN).
- **S21-02c (aplicada 2026-09-29)**: migración
  `20260929195544_cargos-urgencia-temporales.sql` sin aplicar — sin ella fallan Trabajadores,
  Temporales y Cargos (la app ya no usa la columna `position`).
- **S21-02b**: migración `20260929195038_borrar-trabajador.sql` sin aplicar — hasta entonces
  "Borrar trabajador" responde "No se pudo borrar el trabajador" (S21-02 ya aplicada).
- **S19-37 (aplicada 2026-09-29)**: migración `20260929190630_costo-con-iva-al-recibir.sql` sin aplicar — hasta entonces al recibir una orden el costo del
  producto no se actualiza y el kardex entra sin IVA.
- **S19-35 (aplicada 2026-09-29)**: migración `20260929183359_formas-de-entrega.sql`
  sin aplicar — sin ella fallan Pedidos (create_sale con parámetros nuevos), Envíos y el
  Catálogo/Inventario (seleccionan `weight_kg`).
- **S19-34 (aplicada 2026-09-29)**: migración `20260929181537_historial-de-inventario.sql` sin aplicar — hasta
  entonces el Historial de cada inventario muestra "No hubo movimientos".
- **S19-32 (aplicada 2026-09-29)**: migración `20260929173340_stock-por-bodega-editable.sql` sin aplicar — hasta
  entonces editar stock en Inventario falla ("Se guardó el producto, pero no se pudo actualizar
  el stock").
- **S19-28 (aplicada 2026-09-29)**: migración
  `20260929171419_categorias-por-inventario.sql` sin aplicar — sin ella fallan las categorías
  (la app ya filtra por `product_categories.inventory`). Aplicar DESPUÉS de S19-26.
- **S19-23**: migración `20260929154514_eliminar-pos.sql` sin aplicar al cloud (no bloquea: la
  app ya no llama la RPC). `create_product_with_stock` (S13-01) quedó sin uso tras S19-24.
- e2e `core-flow` actualizado para S19-23/S19-24 pero sin correr en este sandbox. Tras S19-30 el
  paso de ingreso de stock se quitó: hay que reescribirlo recibiendo una orden de compra, o el
  paso 8 (confirmar venta) falla por falta de stock.
- **S19-22, bloqueante hasta que se resuelva**: migración
  `20260929151859_boleta-requiere-caja.sql` sin aplicar al cloud — hasta entonces se siguen
  generando boletas sin caja abierta. pgTAP S19-22 (y S5-03/S5-08 con fixtures nuevas) sin correr.
- **S19-21, bloqueante hasta que se resuelva**: la migración
  `20260929151018_editar-eliminar-categorias.sql` no está aplicada al cloud — renombrar/eliminar
  categorías falla hasta aplicarla. S19-18 ya aplicada (confirmado por el humano 2026-09-29).
  `supabase test db` (S19-18, S19-21) sin correr.
- S19-18: la "Principal" no se preselecciona en los formularios de stock/venta/compra — posible
  historia aparte si el humano la pide.
- **S19-15, bloqueante hasta que se resuelva**: la migración
  `20260928231228_categorias-de-producto.sql` (tabla `product_categories` +
  `products.category_id`) está escrita pero **no aplicada** al Supabase cloud — mismo patrón de
  siempre. Hasta que se aplique, el selector de categoría del catálogo y "Generar categoría" van
  a fallar. Nota: S19-01/S19-02/S19-05/S19-08/S19-09/S19-10 sí quedaron aplicadas — confirmado
  indirectamente por el uso real sin errores de columna faltante.
- S19-02 a S19-15: `supabase test db` sigue sin correr (sin Docker en este sandbox) — pendiente de
  que el humano lo corra localmente si tiene Docker.
- S19-05: `/inventario/productos` (ficha completa) no tiene todavía el selector de canal — un
  producto creado ahí queda en `'both'` por default. Agregarlo ahí también (y a la RPC
  `create_product_with_stock`) queda para otra historia si hace falta.
- S19-04: la conversión de moneda depende de una API pública externa (`open.er-api.com`, sin
  key) — sin SLA garantizado. Si falla o cambia de forma, el selector muestra error y los precios
  quedan en la moneda base (no rompe la página), pero no hay fallback a un segundo proveedor.
- S19-03: al reemplazar la foto de un producto en edición, la foto vieja no se borra de Storage
  (queda huérfana). Bajo impacto (bucket chico, MVP), limpiar si el volumen crece.
- S19-01 (aplicada y confirmada 2026-09-28): no hay UI para cambiar el canal de un tenant ya
  creado (solo se define una vez, al onboarding, o a mano por SQL como se hizo para el tenant de
  prueba). Si un tenant físico luego quiere sumar catálogo virtual, hoy no puede sin editar la
  fila a mano.
- Signup (S1-02, detectada en el deploy S9-03): no avisa "revisá tu correo para confirmar" tras
  registrarse — un usuario nuevo puede quedar bloqueado en el primer login sin saber la causa.
  Para el período de beta se desactivó "Confirm email" en Supabase Auth (config de
  infraestructura); al reactivarla de cara a producción real, agregar el aviso en la UI del
  formulario de signup.
- Correos nativos de Supabase Auth (reset de contraseña, y confirmación si se reactiva) usan el
  mailer por defecto de Supabase, con un límite de envío muy bajo pensado para pruebas — no
  Resend, que solo cubre invitaciones de equipo (ADR-028). Causó bloqueo real a un usuario beta el
  2026-09-28 (ver `docs/deploy.md` → Casos borde para el detalle). Fix: configurar SMTP propio
  (reusar Resend) en el dashboard de Supabase — Authentication → Emails → SMTP Settings; no
  requiere cambios en el repo.
- `kardex/[productId]/page.tsx`: `params` con el patrón síncrono viejo (preexistente de S2-04;
  el resto del repo ya usa `params: Promise<{...}>` + `await`).
- `kardex/[productId]/page.tsx`: usa `text-emerald-600`/`text-rose-600` en vez de tokens
  semánticos (`--success`/`--destructive`).
- `src/app/(app)/ventas/pos/pos-terminal.tsx` (S5-10): el total usa
  `toLocaleString(undefined, …)` (locale del navegador); el resto del módulo de ventas fija
  `"es-CO"`. Unificar.
- `src/app/(app)/ventas/pos/pos-terminal.tsx` (S5-10): el botón "Nueva Venta" hace
  `window.location.reload()` en vez de resetear el estado del formulario; funciona pero es tosco.
- Módulo de compras (S12-01): sin E2E propio (`e2e/core-flow.spec.ts` no cubre
  crear/recibir/cancelar/editar orden). Verificado manualmente con Playwright ad-hoc en la sesión
  de S12-01; falta formalizarlo como spec E2E permanente.
- `src/actions/pos.ts` (detectada en auditoría S9-04): no loguea `error.code` de la RPC antes de
  mapear a mensaje genérico, a diferencia del resto de Server Actions — pérdida de
  observabilidad menor, sin fuga de datos al cliente.
- `postcss` (transitiva de `next`, detectada en auditoría S9-04): 2 vulnerabilidades `moderate`
  (GHSA-qx2v-qp2m-jg93, XSS en stringify de CSS) bajo el umbral del gate de CI
  (`--audit-level=high`); remediar requiere downgrade breaking de `next` vía
  `npm audit fix --force` — evaluar al actualizar Next.js.
- `Input`/`Button` del design system (detectada en S11-03): altura `h-8` (32px), por debajo del
  mínimo de 40px de target táctil que exige `miel-design`. Afecta a todos los inputs del ERP, no
  solo al nuevo `PasswordInput`. Evaluar subir a `h-9`/`h-10` en una sesión de design system
  dedicada (cambio transversal, fuera de alcance de una historia puntual).
- Mismo antipatrón que resolvió S13-02 (formulario de edición inyectado en `<td colSpan>` de la
  fila) sigue presente en `compras/proveedores/supplier-row.tsx:22`,
  `ventas/clientes/customer-row.tsx:24`, `gastos/expense-row.tsx:52` y
  `inventario/bodegas/warehouse-row.tsx` — fuera de alcance de S13-02 (solo productos). Aplicar
  el mismo patrón `?editar=<id>` cuando se priorice.
- `purchase_items.unit_cost` (detectada en auditoría de S12-05/ADR-029): sin grant columnar —
  cualquier `member` ya puede leerlo directo de la tabla base (`compras/ordenes/page.tsx` lo
  pinta en pantalla), contradiciendo la matriz de `permisos-roles.md` ("Ver costo de producto" ✖
  member). Requiere decidir: proteger con grant columnar + vista (como `products`), o relajar la
  matriz también para `unit_cost` — toca `compras/`, fuera de alcance de una historia puntual.
- `permisos-roles.md:24` (detectada en S13-03): dice que `member` puede registrar movimientos de
  stock, pero `inventario/page.tsx` y `kardex/[productId]/page.tsx` ocultan el formulario con
  `!isMember`. La UI es más restrictiva que la matriz (no es un agujero de seguridad — RLS/RPC son
  la frontera real) pero es una divergencia a resolver en su propia historia.
- `stock-movement-form.tsx` (detectada en S13-03): el `SelectTrigger` de Producto/Bodega usa el
  ancho por defecto de shadcn (`w-fit`, `whitespace-nowrap`), sin tope de ancho. Con un nombre de
  producto/SKU largo puede desbordar el layout a 375px (confirmado con datos de prueba realistas
  no se reproduce, pero es un riesgo estructural latente desde S13-01). Evaluar `max-w-full
  truncate` o similar en una sesión de design system.
- `inicio/dashboard-metrics-cards.tsx` (detectada en S13-02/S12-02, aún viva tras S14-02): usa un
  `Intl.NumberFormat` local (`formatCurrency`) en vez de `src/lib/format.ts` (`formatMoney`,
  S12-02). Sin bug funcional (mismo locale `es-CO`), es duplicación menor — refactor cosmético,
  no se toca fuera de una historia que ya esté tocando ese archivo por otro motivo.
- El `Sheet` móvil (drawer del menú) no se cierra solo al navegar por ninguno de sus links
  (preexistente, confirmado de nuevo en S14-03 al añadir el logo como link dentro del drawer). Es
  estado no controlado (`Sheet` sin `open`/`onOpenChange`); requiere convertirlo en controlado y
  pasar el cierre a `SidebarNav`/`BrandLink` — cambio transversal, fuera de alcance de una historia
  puntual.

## Fase 2 (fuera del MVP — no crear specs todavía)
Facturación electrónica DIAN · Partida doble formal · App móvil de bodega (Flutter) ·
Multi-moneda · Reportes exportables · Automatización de pedidos y mensajería
(WhatsApp/e-commerce sobre las mismas RPCs) · Devoluciones de venta ·
Activos fijos/depreciación · Gastos recurrentes y presupuestos (fijos esperados con
detección de anomalías) · CRM de captación/pre-venta (leads, oportunidades, pipeline con
etapas, contactos múltiples por cuenta-cliente, agenda comercial) — el módulo actual
(`customers`, `customer_interactions`, `customer_history`) ya cubre CRM post-venta; falta
el lado de adquisición.
