CREATE OR REPLACE VIEW public.low_stock_alerts AS
WITH stock_por_producto AS (
  SELECT
    tenant_id,
    product_id,
    SUM(qty) AS total_qty
  FROM public.stock_movements
  WHERE tenant_id IN (SELECT public.user_tenant_ids())
  GROUP BY tenant_id, product_id
)
SELECT
  p.tenant_id,
  p.id AS product_id,
  p.sku,
  p.name,
  p.min_stock,
  COALESCE(s.total_qty, 0) AS total_qty
FROM public.products p
LEFT JOIN stock_por_producto s ON p.id = s.product_id AND p.tenant_id = s.tenant_id
WHERE p.tenant_id IN (SELECT public.user_tenant_ids())
  AND p.active = true
  AND p.min_stock > 0
  AND COALESCE(s.total_qty, 0) <= p.min_stock;

GRANT SELECT ON public.low_stock_alerts TO authenticated, service_role;
