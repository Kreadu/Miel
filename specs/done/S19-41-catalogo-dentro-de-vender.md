---
id: S19-41
titulo: El Catálogo vive dentro de Vender (sin botón aparte)
estado: implemented
depende_de: [S19-36]
---

# S19-41 — Catálogo dentro de Vender

## Contexto y valor
Pedido del humano (2026-10-07): el contenido de Catálogo se muestra en la página Vender, debajo de
"Gestiona tus clientes y tu sucursal desde los accesos de arriba.", con el título "Catálogo", y
se quita el botón "Catálogo" de los accesos para no duplicar.

## Alcance
- `/ventas` muestra: accesos (sin "Catálogo"), el texto guía y la sección "Catálogo" (categorías,
  generar producto, filtro por categoría y grilla), igual que la página anterior.
- `/ventas/catalogo` redirige a `/ventas` conservando `?categoria=` (enlaces guardados).
- Los enlaces internos ("Ir al catálogo", "Seguir agregando") y los `revalidatePath` apuntan a
  `/ventas`.

## Criterios de aceptación
1. En Vender se ve la sección "Catálogo" debajo del texto guía y no hay botón "Catálogo" arriba.
2. Filtrar por categoría deja al usuario en `/ventas?categoria=…`.
3. Abrir `/ventas/catalogo` lleva a `/ventas`.
4. Responsive igual que antes (375px sin scroll horizontal).

## Plan de tests
Sin lógica nueva: lint, tsc y `npm test`; revisión visual del humano.

## Historial
- 2026-10-07 · creada y aprobada por pedido explícito del humano.
