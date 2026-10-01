---
id: S26-05
titulo: El logo de la empresa cliente reemplaza al de Miel en la app
estado: implemented
depende_de: [S26-01]
---

# S26-05 — Logo de la empresa en la app

Pedido del humano (2026-09-30): donde va el logo de Miel, va el de la empresa que contrata el
programa. Si subió logo en "Mi empresa" (S26-01), el menú (lateral y móvil) muestra su logo con
el nombre de la empresa como texto alternativo; si no, el de Miel. Test del componente.


Implementado: `brand-link.tsx` recibe `logoUrl`/`companyName`; el layout lee `tenants.logo_url`. Sin migración propia (usa la de S26-01).
