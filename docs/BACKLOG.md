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

## Deuda técnica (no bloqueante, sin historia propia — limpiar en sesión de mantenimiento)
- Signup (S1-02, detectada en el deploy S9-03): no avisa "revisá tu correo para confirmar" tras
  registrarse — un usuario nuevo puede quedar bloqueado en el primer login sin saber la causa.
  Para el período de beta se desactivó "Confirm email" en Supabase Auth (config de
  infraestructura); al reactivarla de cara a producción real, agregar el aviso en la UI del
  formulario de signup.
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
