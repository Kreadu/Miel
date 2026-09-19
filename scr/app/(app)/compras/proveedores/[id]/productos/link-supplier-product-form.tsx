"use client";

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

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-end sm:gap-3"
    >
      <input type="hidden" name="supplier_id" value={supplierId} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="product_id">Producto</Label>
        <Select name="product_id" required>
          <SelectTrigger id="product_id" className="w-full">
            <SelectValue placeholder="Selecciona un producto" />
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
        {pending ? "Asociando…" : "Asociar"}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
