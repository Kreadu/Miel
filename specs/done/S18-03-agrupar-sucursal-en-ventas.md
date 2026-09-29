---
id: S18-03
titulo: Ventas queda con 4 accesos; Pedidos/Caja/Punto de Venta se agrupan en Sucursal
estado: implemented
depende_de: [S18-01]
---

# S18-03 — Ventas queda con 4 accesos; Pedidos/Caja/Punto de Venta se agrupan en "Sucursal"

## Contexto y valor

Mirando la app en vivo, el dueño encontró que la página `/ventas` tenía demasiados botones
sueltos (Clientes, Pedidos, Caja, Punto de Venta, Cuentas por cobrar) para alguien con poca
capacitación. Pidió reducirlo a 4 accesos claros, agrupando lo relacionado a operar el local físico
("Sucursal": Pedidos + Caja + Punto de Venta) en un solo lugar.

## Alcance

- `ventas/page.tsx` (módulo raíz): queda con 4 accesos únicamente: **Clientes**, **Sucursal**
  (nuevo), **Cuentas por cobrar** (gating por rol sin cambios: oculto a `member`), **Inicio**
  (nuevo, vuelve a `/inicio`).
- Nueva página `ventas/sucursal/page.tsx`: agrupa los 3 accesos que salieron de la raíz —
  **Pedidos** (`/ventas/pedidos`), **Caja** (`/ventas/caja`), **Punto de Venta** (`/ventas/pos`,
  estilo primario, igual que antes). Mismo estilo visual que la raíz de Ventas (fila de botones),
  sin gating nuevo por rol (ninguno de los 3 lo tenía antes).

## NO-alcance (explícito)

- No se mueven las rutas existentes (`/ventas/pedidos`, `/ventas/caja`, `/ventas/pos` siguen
  siendo las mismas URLs, solo cambia desde dónde se linkean).
- No se saca el paso de abrir caja dentro de Punto de Venta (S18-01) — el RPC de ventas exige
  sesión de caja abierta (`pos_no_open_session`), sacarlo del todo rompería el checkout. Ver
  historial de esta sesión: el humano lo pidió y se le explicó la restricción real de la base de
  datos antes de implementar; aceptó dejarlo como está.
- No se toca `ventas/clientes`, `ventas/cuentas-por-cobrar`, ni ningún contenido interno de
  Pedidos/Caja/Punto de Venta.
- No se agrega todavía el campo "encargado" (S18-02, sigue pendiente y sin spec).

## Criterios de aceptación

1. **Dado** cualquier rol en `/ventas` **cuando** carga la página **entonces** ve exactamente 4
   accesos: Clientes, Sucursal, Cuentas por cobrar (según su rol), Inicio.
2. **Dado** cualquier rol **cuando** entra a `/ventas/sucursal` **entonces** ve 3 accesos: Pedidos,
   Caja, Punto de Venta, funcionando igual que antes (mismas URLs).
3. **Dado** un member **cuando** carga `/ventas` **entonces** no ve "Cuentas por cobrar" (gating
   preexistente sin cambios) pero sí ve "Sucursal".

## Modelo de datos y migraciones

N/A.

## Políticas RLS requeridas

N/A.

## Funciones RPC e invariantes

N/A — sin cambios funcionales en Pedidos/Caja/POS, solo navegación.

## Casos borde

- Ninguno adicional — cambio de navegación puro, sin lógica nueva.

## Consideraciones de seguridad (docs/arch/seguridad.md)

N/A.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 | manual (sin Playwright en este sandbox) | `ventas/page.tsx`, `ventas/sucursal/page.tsx` | verificado a mano por el humano vía `npm run dev` |

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión, con la salvedad explicada de
  que "abrir caja" en Punto de Venta no se puede sacar del todo por una restricción real de la
  base de datos (invariante `pos_no_open_session`) — el humano lo aceptó ("lo arreglaremos, si
  todo esto es prueba").
