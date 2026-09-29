-- S19-10 — corrige el IVA de los productos ya creados por el catalogo con el default viejo
-- (0%, S19-02 lo asumia mal): pasan al estandar de Colombia (19%), mismo default que ya usa
-- products.tax_rate (S2-02) y el formulario completo de inventario. Solo toca SKUs "CAT-%"
-- (los que genera el alta simplificada del catalogo) — no afecta productos de inventario.
-- Ver specs/S19-10-iva-default-catalogo.md.

update public.products
set tax_rate = 19
where sku like 'CAT-%' and tax_rate = 0;
