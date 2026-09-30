---
id: S20-01
titulo: Idiomas (es/en/fr) — módulo 1 de 7: entrada (landing, acceso, empresa, modo tienda, Inicio)
estado: implemented
depende_de: [E20 piloto]
---

# S20-01 — Idiomas: entrada

## Contexto

Pedido del humano 2026-09-30 ("falta lo de los idiomas"). Decisiones: traducir **por módulo en
orden de uso diario** (1 entrada · 2 Vender · 3 Inventario · 4 Comprar · 5 Gastos · 6 Resultados ·
7 RRHH y nómina) y las figuras de Colombia se **traducen dejando la sigla** (p. ej. "VAT (IVA)",
"Electronic payroll (DIAN)"). Arquitectura en ADR-040.

## Alcance (hecho)

Landing (con selector de idioma), login, registro, recuperar/nueva contraseña (con selector),
crear empresa, invitación, modo tienda (código, salir, controles del menú), marco de la app
(rol, cerrar sesión, menú móvil), Inicio (módulos, resumen gerencial), tema claro/oscuro.
Corregido de paso: el resumen gerencial de Inicio no filtraba por empresa (dueño de varias).

## Criterios

- Las acciones devuelven claves (`auth.errors.*`, `store.errors.*`…), nunca texto; el formulario
  las traduce. Zod usa claves como mensaje.
- `src/i18n/messages.test.ts`: es/en/fr con las mismas claves y sin textos vacíos.
