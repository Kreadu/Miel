"use client";

import { useTranslations } from "next-intl";
import { unlinkSupplierProduct } from "@/actions/supplier-products";
import { Button } from "@/components/ui/button";

export function UnlinkSupplierProductAction({
  supplierId,
  productId,
}: {
  supplierId: string;
  productId: string;
}) {
  const t = useTranslations("suppliers.productsPage");
  return (
    <form
      action={unlinkSupplierProduct}
      onSubmit={(e) => {
        if (!confirm(t("unlinkConfirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="product_id" value={productId} />
      <Button type="submit" variant="ghost" size="sm">
        {t("unlink")}
      </Button>
    </form>
  );
}
