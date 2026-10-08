---
id: S27-08
titulo: Productos de la tienda física en el catálogo web y pie fijo de Kreadu
estado: implemented
depende_de: [S27-01, S27-02]
---

# S27-08 — Tienda física visible en la web y pie de Kreadu

## Decisiones (humano, 2026-10-08)
1. **Productos de tienda física en el catálogo web.** Los productos "solo tienda física"
   (`sales_channel = 'in_store'`) aparecen con foto y precio y la etiqueta "Disponible en nuestra
   tienda física" en vez de "Agregar", junto con la dirección de la tienda. Así hacen publicidad y
   la gente sabe que la tienda existe. No se pueden pedir por la web: `place_store_order` ya los
   rechaza (`product_unavailable`). `store_catalog` devuelve `sales_channel`.
2. **Pie fijo de Kreadu**, la empresa que desarrolla Miel: aparece igual en todas las tiendas,
   debajo del pie de cada empresa, para que cualquiera que vea una tienda pueda contactarla. Los
   datos son fijos en el código (`src/lib/platform/developer.ts`): KREADU · KREADU S.A.S. — NIT
   901790185-0 · Company: AI Business Systems Lab, Academy, KREADU School · Contact: Let's Talk,
   is@kreadu.com, (+57) 3235297951, (+57) 3225832662 · Social. Los enlaces y las redes sin URL no se
   muestran como enlace o no aparecen hasta que el humano las dé. Modifica la marca blanca de
   ADR-044 (ver ADR-045).

## Criterios
1. `store_catalog` incluye los productos `in_store` con `sales_channel`. Pedirlos por la web sigue
   rechazándose.
2. La tarjeta de un producto `in_store` no tiene "Agregar" y muestra la etiqueta.
3. El pie de Kreadu aparece en la tienda con esos datos. Los teléfonos abren WhatsApp y el correo
   abre el correo.

## Tests
- pgTAP: `supabase/tests/S27-08-tienda-fisica.sql`. Se ajustó S27-01: el catálogo pasa de 2 a 3
  productos.
- Vitest: pie de Kreadu.

## Historial
- 2026-10-08 · approved por el humano.
- 2026-10-08 · implemented. Migración `20261008210000_tienda-fisica-en-la-web.sql`; ADR-045. Los
  enlaces de Company y las redes quedan sin URL hasta que el humano las dé. Sin revisión visual.
