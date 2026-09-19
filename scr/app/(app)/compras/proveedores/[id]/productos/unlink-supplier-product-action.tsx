"use client";

import { unlinkSupplierProduct } from "@/actions/supplier-products";
import { Button } from "@/components/ui/button";

export function UnlinkSupplierProductAction({
  supplierId,
  productId,
}: {
  supplierId: string;
  productId: string;
}) {
  return (
    <form
      action={unlinkSupplierProduct}
      onSubmit={(e) => {
        if (!confirm("¿Quitar este producto de los sugeridos para el proveedor?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="product_id" value={productId} />
      <Button type="submit" variant="ghost" size="sm">
        Quitar
      </Button>
    </form>
  );
}
