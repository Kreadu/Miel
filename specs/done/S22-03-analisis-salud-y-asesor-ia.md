---
id: S22-03
titulo: Resultados por rango de meses, análisis gráfico, salud de la empresa y asesor con IA
estado: implemented
depende_de: [S22-02, S23-01]
---

# S22-03 — Análisis, salud y asesor con IA

## Contexto y valor

Pedido del humano 2026-09-30: debajo del estado de resultados, un análisis gráfico y un resumen
de la salud de la empresa; más abajo, un espacio donde los dueños le preguntan a la IA cómo
mejorar. Decisiones del humano: IA = Claude de Anthropic; los datos se eligen por **rango de
meses**; la IA ve cifras agregadas **y los productos** (sin datos de personas); más adelante
debe poder cambiarse de IA.

## Alcance

1. **Rango**: `/resultados?desde=AAAA-MM&hasta=AAAA-MM` (por defecto los últimos 6 meses, máx.
   24; desde ≤ hasta). El estado de resultados muestra el **total del rango** con sus márgenes.
   Todas las consultas filtran por la empresa activa (antes no: un dueño de dos empresas veía
   cifras mezcladas).
2. **Gráficos** (mes a mes del rango): "Ventas y utilidad neta" (barras) y "Márgenes" (líneas:
   bruto, operativo, neto). Leyenda, tooltip y tabla "Ver cifras por mes". Paleta de gráficos
   validada (daltonismo y contraste, claro y oscuro) en los tokens `--chart-*`.
3. **Salud** (reglas fijas, sin IA), cada indicador con ícono + etiqueta (Bien / Atención /
   Crítico) y una frase:
   - Rentabilidad (margen neto del rango): ≥ 10 % bien, 0–10 % atención, < 0 crítico.
   - Margen bruto: ≥ 30 % bien, 15–30 % atención, < 15 % crítico.
   - Margen operativo: ≥ 8 % bien, 0–8 % atención, < 0 crítico.
   - Tendencia de ventas (último mes vs. promedio de los anteriores del rango, ≥ 2 meses):
     ≥ 0 % bien, −15 %–0 atención, < −15 % crítico.
   - Liquidez: (cartera + inventario) ÷ cuentas por pagar: ≥ 1,5 bien, 1–1,5 atención, < 1
     crítico; sin cuentas por pagar = bien.
   Sin ventas en el rango: "Sin datos suficientes".
4. **Asesor con IA** (owner/admin): pregunta (3–1000 caracteres) → respuesta en texto plano.
   Contexto armado **en el servidor** desde la BD (nunca desde el navegador): estado de
   resultados mes a mes del rango, salud, cartera/cuentas por pagar/inventario, y los 10
   productos con más ventas del rango con su margen. Se guarda cada pregunta y respuesta
   (`advisor_questions`, RLS owner/admin) y se muestran las últimas 10. Límite: 20 preguntas por
   empresa por día.
   - Proveedor aislado en `src/lib/ai/advisor.ts` (único archivo que conoce a Anthropic):
     cambiar de IA = reemplazar ese archivo. SDK oficial, `claude-opus-5-5`, esfuerzo `medium`,
     respaldo automático del servidor si el modelo se niega (`fallbacks: "default"`).
   - Llave `ANTHROPIC_API_KEY` solo en `.env.local` (servidor). Sin llave: "La IA no está
     configurada".

## Seguridad (casos de abuso)

- Inyección en la pregunta: la IA no tiene herramientas ni acceso a la BD; solo puede afectar su
  propia respuesta. System prompt separa instrucciones de datos; los datos (incluidos nombres de
  productos) van marcados como datos, no instrucciones.
- Datos de otra empresa: el contexto se arma con la sesión del usuario (RLS) y filtro explícito
  de la empresa activa; el navegador solo manda la pregunta y el rango.
- Operativo o modo tienda: la acción responde "sin permiso"; la tabla no le deja leer ni escribir.
- Respuesta mostrada como texto (sin HTML). Errores internos no llegan al cliente.
- Costo: límite diario por empresa.

## NO-alcance

Elegir proveedor de IA desde la pantalla; conversación con memoria (cada pregunta es
independiente); exportar.

## Tests

Vitest: `health.test.ts`, `range.test.ts`, `advisor-context.test.ts`, validación del asesor,
acción `askAdvisor` (permiso, límite, sin llave). pgTAP `S22-03-asesor.sql` (RLS).
