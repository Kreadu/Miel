---
id: S7-03
titulo: Página de Finanzas y gráficas gerenciales
estado: implemented
depende_de: [S7-02]
---

# S7-03 — Página de Finanzas y gráficas gerenciales

## Contexto y valor
Para que el gerente pueda detectar fugas y oportunidades de un vistazo, la información generada en S7-02 (P&L, flujo de caja, etc.) debe presentarse de manera visual. Gráficas claras permiten tomar decisiones sobre gastos variables, rentabilidad y estado de la caja de forma rápida.

## Alcance
- Creación de la página `/finanzas` en la aplicación (accesible solo para owner y admin).
- Implementación de gráficas (usando la librería de gráficas del proyecto, ej. `recharts`) integradas armónicamente con `miel-design`.
- Gráficas a incluir:
  1. Evolución mensual de ingresos netos vs gastos totales (basado en `monthly_pnl`).
  2. Distribución de gastos mensuales por categoría y tipo (fijo vs variable, basado en `monthly_expenses`).
  3. Flujo de caja: Entradas vs Salidas por mes (basado en `cash_flow`).
  4. (Opcional) Tabla resumen o gráfica de top productos más/menos rentables.
- Inclusión del acceso a Finanzas en la navegación principal (sidebar).

## NO-alcance (explícito)
- Generación de reportes PDF o exportación a Excel (pertenece a la Fase 2).
- Dashboard general de ventas/stock (pertenece a la Épica 8, S8-01/S8-02).

## Criterios de aceptación
1. **Dado** un `owner` o `admin`, **cuando** navega a `/finanzas`, **entonces** puede ver gráficas renderizadas correctamente utilizando la data de las vistas de BD (ej. `monthly_pnl`).
2. **Dado** un `member`, **cuando** intenta navegar a `/finanzas`, **entonces** el sistema le niega el acceso visualizando `notFound()` o un error 404 (gating por rol en el servidor).
3. **Dado** un `owner` o `admin`, **cuando** observa los gastos, **entonces** puede distinguir claramente la proporción de gastos fijos vs variables.
4. **Dado** el usuario viendo las gráficas, **cuando** pasa el cursor por encima (hover), **entonces** ve tooltips formateados correctamente con el estándar de moneda local de la app.
5. **Dado** un tenant sin datos aún, **cuando** entra a la página, **entonces** el sistema maneja el "empty state" de forma elegante sin romper la interfaz.

## Modelo de datos y migraciones
- N/A. Todo el consumo de datos es a través de las vistas creadas y probadas en S7-02.

## Políticas RLS requeridas
- N/A (la base de datos ya está protegida; aquí aplica protección en la UI y Server Components limitando acceso a `owner`/`admin`).

## Funciones RPC e invariantes
- N/A.

## Casos borde
- Meses sin actividad (manejados previamente en las vistas, pero la UI debe graficarlos como cero).
- Valores extremos (manejar responsive en gráficas).
- Componentes de UI: Asegurarse de que `toLocaleString("es-CO", ...)` se use sistemáticamente para evitar inconsistencias de formato, como se señaló en la deuda técnica del BACKLOG.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La protección de ruta (`boundary de servidor`) debe realizarse en `page.tsx` o un layout propio interceptando el rol del tenant activo.

## Plan de tests (qué test cubre qué criterio)
Al ser una historia enteramente visual (la lógica de BD ya fue probada al 100% en S7-02), la validación recae en:
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 2 | Code/UI | `src/app/(app)/finanzas/page.tsx` | Validación explícita de `role !== 'member'` con desvío a `notFound()`. |
| 1, 3, 4, 5 | Humano | UI de la App | Verificación visual de renderizado, accesibilidad, empty states y tooltips. |

## Historial
- 2026-07-20 · creada (draft)
- 2026-07-21 · bug preexistente corregido (hallado durante la verificación humana de S9-02, al
  poblar `/finanzas` con datos de gastos reales por primera vez): `expenses-chart.tsx` — el
  tooltip de "Gastos Mensuales" hacía `data.categories.sort(...)` sobre el objeto memoizado
  (`useMemo`) que Recharts pasa congelado en `payload[0].payload`, `.sort()` muta in-place →
  `TypeError: 0 is read-only` al abrir el tooltip. Nunca se detectó antes porque el módulo
  estuvo vacío desde su implementación. Fix de una línea: copiar el array antes de ordenar
  (`[...data.categories].sort(...)`). `npm run lint`/`npx tsc --noEmit` verificados en verde.
