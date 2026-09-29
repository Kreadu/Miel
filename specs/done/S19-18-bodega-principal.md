---
id: S19-18
titulo: Bodega o sucursal "Principal" por empresa, con ubicación y contacto
estado: implemented
depende_de: [S2-01, S19-01]
---

# S19-18 — Bodega o sucursal "Principal" por empresa

## Contexto y valor

Pedido del humano 2026-09-29: cada empresa debe tener siempre una bodega o sucursal por
defecto ("Principal"), creada sola (también para las empresas existentes), renombrable. Las
bodegas o sucursales llevan dirección, departamento, ciudad, país, código postal, teléfono y
WhatsApp. Aprobación: pedido explícito; spec + implementación en la misma sesión.

## Alcance

- `warehouses` gana `is_default` (bool, default false) y 7 columnas de texto nullable:
  `address`, `department`, `city`, `country`, `postal_code`, `phone`, `whatsapp` (para todas las
  bodegas o sucursales, no solo la principal).
- Invariantes en BD:
  - una sola principal por empresa (índice único parcial);
  - la principal no se archiva (`check (active or not is_default)`);
  - `is_default` no es escribible por `authenticated` (grants de insert/update por columna).
- `create_tenant_with_owner` crea "Principal" junto con la empresa. Backfill en la migración
  para empresas existentes sin principal (`created_by` = su owner más antiguo).
- La misma migración restaura la invariante de S14-04 (sin membership previa para fundar una
  empresa), que la redefinición de S19-01 había perdido — hallazgo de esta sesión.
- `/inventario/bodegas`: alta y edición con los 7 campos; la principal va primero, lleva
  la etiqueta "Principal" y no muestra "Archivar".

## Supuestos (texto del pedido llegó cortado)

- "no archi…" → la principal no se puede archivar.
- No se preselecciona la principal en los formularios de stock/venta/compra (no pedido de forma
  explícita; queda como posible historia aparte).

## Criterios de aceptación

1. **Dado** una empresa nueva **entonces** tiene una bodega "Principal".
2. **Dado** una empresa existente sin principal **cuando** se aplica la migración **entonces**
   recibe una.
3. **Dado** un owner/admin **entonces** puede renombrar la principal y cargar sus datos.
4. **Dado** la principal **entonces** no se puede archivar ni desmarcar, y no puede haber dos.
5. Aislamiento: otra empresa no ve la principal ajena.

## Tests

- pgTAP `supabase/tests/S19-18-bodega-principal.sql` (C1–C5; el backfill no es testeable en
  pgTAP porque corre en la migración — se verifica con la consulta de control del SQL).
- Vitest `warehouses.test.ts`: campos opcionales, vacío → null, largo máximo.
