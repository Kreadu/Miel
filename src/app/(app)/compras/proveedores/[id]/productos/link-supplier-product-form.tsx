"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { linkSupplierProduct } from "@/actions/supplier-products";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Product = { id: string; sku: string; name: string };

export function LinkSupplierProductForm({
  supplierId,
  products,
}: {
  supplierId: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(linkSupplierProduct, null);
  const t = useTranslations();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-end sm:gap-3"
    >
      <input type="hidden" name="supplier_id" value={supplierId} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="product_id">{t("suppliers.productsPage.product")}</Label>
        <Select name="product_id" required>
          <SelectTrigger id="product_id" className="w-full">
            <SelectValue placeholder={t("suppliers.productsPage.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("suppliers.productsPage.linking") : t("suppliers.productsPage.link")}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
