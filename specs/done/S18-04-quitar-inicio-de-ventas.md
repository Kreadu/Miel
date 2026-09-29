---
id: S18-04
titulo: Quitar el acceso "Inicio" de la raíz de Ventas
estado: implemented
depende_de: [S18-03]
---

# S18-04 — Quitar el acceso "Inicio" de la raíz de Ventas

## Contexto y valor

Mirando la app en vivo tras S18-03, el dueño pidió sacar el botón "Inicio" de `/ventas` — ya
existe una forma de volver (logo/"Miel" del sidebar, S14-03), y para alguien que solo quiere
vender rápido un botón más en esa fila es ruido.

## Alcance

- `ventas/page.tsx`: se quita el link "Inicio" (`href="/inicio"`) y el import de su ícono
  (`Home`, de `lucide-react`) que queda sin uso.

## NO-alcance (explícito)

- No se toca el sidebar ni la navegación global (S14-03 ya cubre volver a Inicio desde ahí).
- No se tocan los otros 3 accesos de `/ventas` (Clientes, Sucursal, Cuentas por cobrar).
- No se toca `ventas/sucursal/page.tsx`.

## Criterios de aceptación

1. **Dado** cualquier rol **cuando** carga `/ventas` **entonces** ve 3 accesos: Clientes,
   Sucursal, Cuentas por cobrar (según su rol) — sin "Inicio".
2. **Dado** cualquier rol **cuando** quiere volver a Inicio desde `/ventas` **entonces** puede
   hacerlo por el logo/sidebar (sin cambios, ya existente).

## Modelo de datos y migraciones

N/A.

## Políticas RLS requeridas

N/A.

## Funciones RPC e invariantes

N/A — cambio de navegación puro.

## Casos borde

- Ninguno adicional.

## Consideraciones de seguridad (docs/arch/seguridad.md)

N/A.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | manual (sin Playwright en este sandbox) | `ventas/page.tsx` | verificado a mano por el humano vía `npm run dev` |

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión ("saquemos el botón de inicio
  dentro de vender").
