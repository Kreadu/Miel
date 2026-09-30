---
id: S21-05
titulo: Nómina — licencias, liquidación por período con el motor, ver nómina y XML DIAN
estado: implemented
depende_de: [S21-01, S21-02]
---

# S21-05 — Nómina

## Contexto y valor

Pedido del humano 2026-09-29: generar la nómina de pago al trabajador, agregar las licencias,
ver la nómina y generarla para la DIAN (S21-03, ingreso con código, queda para después).

## Alcance

- Migración `20260929200638_nomina.sql`: `worker_leaves` (tipos del motor), `payroll_periods`,
  `payroll_settlements` (novedades + resultado jsonb + estado DIAN), `dian_settings`,
  `dian_counters`; todo RLS solo owner/admin; triggers de coherencia (trabajador/período de la
  misma empresa); RPC `next_dian_consecutive` (atómica) y `create_payroll_period` (período +
  liquidaciones en una sola transacción, security invoker).
- Cálculo en el servidor con el motor copiado (ADR-036): `src/lib/rrhh/payroll-input.ts`
  (licencias en el período, días por defecto por ingreso/término, nombres, códigos DIAN) y
  `liquidate.ts` (mensual para planta/temporal, jornada parcial para por horas; errores
  legibles, nunca lanza). Prestación de servicios no entra a la nómina.
- Pantallas: `/equipo/nomina` (períodos, "Nuevo período" crea y liquida), `/equipo/nomina/[id]`
  (tabla por trabajador, novedades editables, desglose devengado/deducciones/costo empresa,
  recalcular, cerrar, borrar sin DIAN), `/equipo/licencias`, `/equipo/nomina/dian` (datos de
  la empresa y software), descarga del XML en `/equipo/nomina/xml/[id]`.
- Nómina electrónica: `DianNominaXmlService.generateDSPNE` con consecutivo `NE########` y CUNE;
  el XML queda guardado en la liquidación. **No se envía a la DIAN** (no hay firma digital ni
  conexión al servicio web): se genera el archivo para cargarlo o enviarlo con un proveedor.
- `formatDate` corrige fechas sin hora ("AAAA-MM-DD"), que se mostraban un día antes.

## NO-alcance

- Envío/firma ante la DIAN; nómina de ajuste; pago bancario; contratistas (documento soporte).

## Tests

- pgTAP `supabase/tests/S21-05-nomina.sql`. Vitest `src/lib/rrhh/payroll-input.test.ts`,
  `src/lib/rrhh/liquidate.test.ts`, `src/lib/validation/payroll.test.ts`,
  `src/actions/payroll.test.ts`, `src/lib/format.test.ts`.
