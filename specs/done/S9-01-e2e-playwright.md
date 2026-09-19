---
id: S9-01
titulo: Setup E2E Testing (Playwright)
estado: implemented
depende_de: [S1-03, S2-03, S5-06]
---

# S9-01 — Pruebas E2E de humo con Playwright

## Contexto y valor
Para asegurar la estabilidad del producto de cara al release beta (Sprint 9) y evitar regresiones futuras en el "camino feliz", necesitamos una prueba de humo End-to-End (E2E) que automatice el flujo vital de negocio: desde que un usuario entra, carga inventario, vende y entrega. 

## Alcance
- Instalación y configuración de Playwright en el proyecto.
- Creación de un script `npm run test:e2e` y `npm run test:e2e:ui`.
- Un test E2E (`e2e/core-flow.spec.ts`) que cubra el camino feliz:
  - Login con un usuario existente.
  - Creación de un producto.
  - Ingreso de stock (register movement) para dicho producto.
  - Creación de un pedido/venta (borrador).
  - Confirmación de la venta.
  - Despacho y/o entrega de la venta.
- Configuración básica de un flujo de CI (GitHub Actions) que levante Supabase local, inicie Next.js y ejecute los tests de Playwright.

## NO-alcance (explícito)
- Cobertura E2E del 100% de la aplicación (flujos alternativos, manejo de errores en UI, producción, finanzas, onboarding). Solo se probará el "happy path" crítico.
- Setup de un entorno de staging en la nube (el CI utilizará `supabase start` y la DB local efímera para correr de forma aislada).

## Criterios de aceptación (máx ~5; si necesitas más, parte la historia)
1. **Dado** un entorno local con la app en marcha **cuando** se ejecuta el script de E2E **entonces** Playwright completa la prueba del core flow de manera exitosa en modo headless.
2. **Dado** el test E2E **cuando** Playwright automatiza la UI **entonces** el test no depende de esperas (sleeps) arbitrarias sino de aserciones confiables y auto-esperas de UI (ej. validando la aparición de toasts o cambios de url).
3. **Dado** un commit en un Pull Request o rama `main` **cuando** Github Actions se dispara **entonces** levanta el stack, corre Playwright y aprueba el check.

## Modelo de datos y migraciones
N/A

## Políticas RLS requeridas
N/A

## Funciones RPC e invariantes
N/A

## Casos borde
- **Flakiness (inestabilidad):** Playwright podría fallar si la interfaz es lenta. Se deben usar selectores por atributos de accesibilidad o roles (`getByRole`, `getByText`) y verificar que el estado global de red o las transiciones no presenten condiciones de carrera.
- **Estado de la BD:** el test E2E se basará en un `supabase db reset`. Si es necesario, el propio test creará la data base (un warehouse y cliente si no están presentes por seed base).

## Consideraciones de seguridad (docs/arch/seguridad.md)
N/A para cambios de código de producción. Las pruebas usarán un usuario de prueba (creado previamente o en tiempo de ejecución de test) sin exponer secretos de producción; el workflow de CI usará las credenciales por defecto de Supabase local.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | Playwright | e2e/core-flow.spec.ts | El test automatizado de flujo feliz completo. |
| 3 | CI Workflow | .github/workflows/e2e.yml | Ejecución automatizada en pipeline. |

## Historial
- 2026-07-21 · creada (draft)
- 2026-07-21 · auditoría: faltaba el script `npm run test:e2e:ui` exigido en el Alcance (solo existía `test:e2e`). Agregado a `package.json`. Al correr `npm run lint`/`npx tsc --noEmit` (nunca reportados en la sesión original) aparecieron 2 fallos reales en código de esta historia: import `useState` sin usar en `movement-form.tsx`, y un error de tipos en `inventario/page.tsx` (`products_catalog` devuelve columnas nullable, incompatibles con el `Product` no-nullable de `ManualMovementForm`). Ambos corregidos. `lint` y `tsc --noEmit` verificados en verde tras el fix.
