---
id: S9-02
titulo: Seeds de demo para prospectos
estado: implemented
depende_de: [S2-04, S3-03, S5-03, S6-02, S7-01]
---

# S9-02 — Seeds de demo para prospectos

## Contexto y valor
Para mostrar la aplicación a prospectos de forma efectiva, necesitamos un entorno de demostración con datos realistas que muestre el valor de la plataforma inmediatamente (gráficas, kardex, historial CRM) sin tener que capturarlo todo manualmente en cada presentación.

## Alcance
- Script en TypeScript (`scripts/seed-demo.ts`) ejecutable vía `npm run seed`.
- Creación (idempotente, con borrado previo si existe) de un tenant "Miel Demo" y un usuario Owner (`demo@miel.test`).
- Carga de datos base: Bodegas, Productos (insumos y terminados), Proveedores y Clientes.
- Simulación de compras (y recepción para inyectar stock).
- Simulación de producción (consumo de insumos y generación de terminados).
- Simulación de ventas (con confirmación, pagos, descuentos) y despachos.
- Registro de interacciones CRM postventa.
- Registro de gastos generales (fijos y variables) distribuidos en los últimos meses para popular gráficas.
- Uso del `service_role` de Supabase para saltar RLS y optimizar la inserción.

## NO-alcance (explícito)
- Interfaz gráfica para cargar el seed (es estrictamente un script CLI).
- Datos masivos para pruebas de carga o estrés (solo datos suficientes para que las gráficas y vistas se vean completas y reales).

## Criterios de aceptación
1. **Dado** un entorno configurado **cuando** se ejecuta `npm run seed` **entonces** el script inserta un usuario `demo@miel.test`, un tenant "Miel Demo" y datos coherentes sin fallar por constraints de base de datos.
2. **Dado** el script de seed **cuando** se ejecuta múltiples veces consecutivas **entonces** el script es idempotente (borra los datos anteriores de Miel Demo antes de insertar los nuevos) sin duplicar información.
3. **Dado** el dashboard gerencial y la página de finanzas **cuando** el usuario de demo inicia sesión **entonces** los paneles (tops, alertas, flujo de caja, P&L) tienen datos relevantes de los últimos meses, evidenciando ingresos y gastos.

## Modelo de datos y migraciones
No requiere cambios al modelo de datos ni migraciones. Utiliza las tablas existentes.

## Políticas RLS requeridas
N/A. Se usará la llave `SUPABASE_SERVICE_ROLE_KEY` del lado del servidor/CLI.

## Funciones RPC e invariantes
Se invocan las RPCs existentes en el script (`register_movement`, `receive_purchase`, `confirm_sale`, etc.) o se inserta directo si es estrictamente necesario y seguro de invariantes (al estar en un script con service_role, debe tener cuidado de no romper referencias lógicas, como stock vs kardex). Idealmente las inserciones simulan los eventos llamando a las mismas RPCs que usa la aplicación, asegurando coherencia.

## Casos borde
- Si el usuario o el tenant ya existían de ejecuciones pasadas, el script limpia en reversa el tenant (borrando filas en cascada inversa manualmente, ya que las tablas carecen de ON DELETE CASCADE).
- Para ventas y pagos pasados, las fechas (`created_at`, `issued_at`, `paid_at`) se alteran para estar en meses pasados, lo cual obliga a usar insert directos en ciertas tablas o pasar parámetros de fecha en las RPC si los soportan, y en su defecto hacer update a las filas recién insertadas con `service_role` para simular paso de tiempo.

## Consideraciones de seguridad (docs/arch/seguridad.md)
N/A. Es un script de desarrollo/operaciones, la llave de service_role nunca se envía al cliente.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Ejecución | `npm run seed` | El script termina sin errores. |
| 2 | Ejecución | `npm run seed` repetido | Funciona repetidamente sin violaciones de unicidad. |
| 3 | Visual | Navegador (`/inicio`, `/finanzas`) | Gráficas e indicadores gerenciales con data verídica. |

## Historial
- 2026-07-21 · creada (approved)
- 2026-07-21 · auditoría pre-commit (regla #9): implementación previa marcada `done` era
  incompleta. Hallazgos: CA2 (idempotencia) no implementado (el script abortaba con
  `process.exit(0)` si el tenant ya existía en vez de limpiar); Alcance incumplido (compras
  simuladas con `stock_movements` directo, sin `purchases`/`receive_purchase`; producción sin
  consumo real de insumos); regla innegociable #2 violada (lógica transaccional vía inserts
  encadenados de supabase-js en vez de las RPCs de negocio). Reescrito el script para: (a)
  limpieza idempotente reversa real del tenant demo; (b) autenticar como `demo@miel.test` y
  usar `create_purchase`+`receive_purchase`, `register_production` (con consumos reales según
  receta), `create_sale`+`confirm_sale` y los `register_*_payment` para toda la lógica de
  negocio, dejando `service_role` solo para limpieza, catálogos base (bodegas, proveedores,
  clientes, productos, recetas) y post-datado de fechas tras cada operación (tal como preveían
  los "Casos borde" de esta spec). Migración de grant acotada (sin `ALL ROUTINES`, ver
  ADR-023). Estado permanece `approved`: falta que el humano corra `npm run seed` (dos veces,
  CA2) y verifique visualmente `/inicio`/`/finanzas` (CA3) antes de marcar `implemented`.
- 2026-07-21 · verificación humana completa: `supabase db reset` + `npm run seed` (dos veces
  consecutivas, sin duplicados — CA2 confirmado) + `supabase test db` 335/335 pgTAP + login
  `demo@miel.test` con `/inicio` y `/finanzas` poblados (CA3 confirmado). Durante la
  verificación se detectó y corrigió un bug preexistente de S7-03 (mutación in-place en el
  tooltip de gastos, ver `specs/done/S7-03-finanzas-graficas.md`) que bloqueaba `/finanzas`.
  Estado → `implemented`.
