---
id: S18-05
titulo: Revertir agrupación "Sucursal" — Pedidos/Caja/POS vuelven a la raíz de Ventas
estado: implemented
depende_de: [S18-03]
---

# S18-05 — Revertir agrupación "Sucursal": Pedidos/Caja/POS vuelven a la raíz de Ventas

## Contexto y valor

El dueño probó la agrupación de S18-03 y pidió deshacerla: quiere Pedidos, Caja y Punto de Venta
de nuevo como accesos directos en `/ventas`, sin el paso intermedio de "Sucursal".

## Alcance

- `ventas/page.tsx`: el link "Sucursal" se reemplaza por los 3 links que agrupaba (Pedidos, Caja,
  Punto de Venta — mismos íconos y estilos que tenía `ventas/sucursal/page.tsx`), gateado por
  `active.sellsPhysical` igual que antes (si el tenant no vende físico, no se muestran).
- Se borra `ventas/sucursal/page.tsx` (la ruta `/ventas/sucursal` deja de existir).

## NO-alcance (explícito)

- No se toca "Catálogo online" (S19-01), "Clientes" ni "Cuentas por cobrar".
- No se mueven las rutas `/ventas/pedidos`, `/ventas/caja`, `/ventas/pos` — siguen igual, solo
  cambia desde dónde se linkean (vuelven a la raíz, como antes de S18-03).

## Criterios de aceptación

1. **Dado** un tenant con `sellsPhysical` **cuando** entra a `/ventas` **entonces** ve Pedidos,
   Caja y Punto de Venta como accesos directos (sin pasar por "Sucursal").
2. **Dado** cualquiera **cuando** visita `/ventas/sucursal` **entonces** la ruta ya no existe
   (404).

## Modelo de datos y migraciones

N/A.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1, 2 | manual (sin Playwright en este sandbox) | verificado a mano por el humano vía `npm run dev` |

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión ("Todo lo que está dentro de
  la sucursal sacalo y dejalo en la página vender, y borra sucursal").
