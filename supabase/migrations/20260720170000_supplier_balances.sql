-- Migración para S4-02: Vista de Cuentas por Pagar y Saldos por Proveedor

CREATE OR REPLACE VIEW public.supplier_balances AS
WITH purchase_totals AS (
    SELECT supplier_id, COALESCE(SUM(total), 0) AS total_purchases
    FROM public.purchases
    WHERE status IN ('ordered', 'received')
    GROUP BY supplier_id
),
payment_totals AS (
    SELECT supplier_id, COALESCE(SUM(amount), 0) AS total_paid
    FROM public.supplier_payments
    GROUP BY supplier_id
)
SELECT
    s.tenant_id,
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.nit AS supplier_nit,
    COALESCE(pt.total_purchases, 0) AS total_purchases,
    COALESCE(pay.total_paid, 0) AS total_paid,
    (COALESCE(pt.total_purchases, 0) - COALESCE(pay.total_paid, 0)) AS balance
FROM public.suppliers s
LEFT JOIN purchase_totals pt ON s.id = pt.supplier_id
LEFT JOIN payment_totals pay ON s.id = pay.supplier_id
WHERE s.tenant_id IN (SELECT public.user_tenant_ids());

-- Otorgar permisos de lectura a los usuarios autenticados
GRANT SELECT ON public.supplier_balances TO authenticated;
