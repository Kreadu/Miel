---
id: S<sprint>-<nn>
titulo: <título corto>
estado: draft            # draft → approved → implemented
depende_de: []           # IDs de historias que deben estar done
---

# S<sprint>-<nn> — <Título>

## Contexto y valor
<Por qué existe esta historia; qué problema del usuario resuelve. 2–4 líneas.>

## Alcance
- <Qué SÍ incluye, en viñetas concretas.>

## NO-alcance (explícito)
- <Qué NO se hace en esta historia aunque parezca cercano. Evita el scope creep.>

## Criterios de aceptación (máx ~5; si necesitas más, parte la historia)
<Si la historia incluye UI: al menos un criterio debe expresar comportamiento responsive
verificable (p. ej. "en viewport 375px la navegación colapsa a drawer y no hay scroll horizontal"),
ver `miel-design/SKILL.md` sección Responsive y mobile-first (ADR-025).>
1. **Dado** <estado inicial> **cuando** <acción> **entonces** <resultado verificable>.
2. …

## Modelo de datos y migraciones
<Tablas/columnas/vistas nuevas o alteradas. SQL esquemático. Referencia a docs/data-model.md.>

## Políticas RLS requeridas
<Por tabla: qué política, qué roles. Referencia al patrón de docs/arch/multitenancy-rls.md.>

## Funciones RPC e invariantes
<Firma de cada función y lista explícita de invariantes que protege. "N/A" si no aplica.>

## Casos borde
- <Lista de situaciones límite y comportamiento esperado en cada una.>

## Consideraciones de seguridad (docs/arch/seguridad.md)
<Qué controles del estándar aplican a esta historia (validación de boundaries, redirects,
headers, errores genéricos, datos no confiables) y cómo se cumplen. "N/A" solo con
justificación explícita.>

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S<s>-<nn>-….sql | … |
| 2 | Vitest | src/….test.ts | … |

## Historial
- <fecha> · creada (draft)
