"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_TAX_COUNTRY_LABEL, DEFAULT_TAX_RATE_PERCENT } from "@/lib/validation/catalog";

import { CategoryPicker } from "./category-picker";
import type { Category, ProductKind, ProductView, SalesChannel } from "./types";

const KINDS: ProductKind[] = ["raw", "finished", "resale"];
const CHANNELS: SalesChannel[] = ["online", "in_store", "both"];

/**
 * S19-24: campos del formulario único de producto (Inventario y Catálogo). El stock se muestra
 * solo para leer: viene de los movimientos de cada bodega o sucursal.
 */
export function ProductFields({
  product,
  categories,
}: {
  /** Al editar; sin producto es un alta. */
  product?: ProductView;
  categories: Category[];
}) {
  const t = useTranslations("catalog");
  const kindLabel: Record<ProductKind, string> = {
    raw: t("kindRaw"),
    finished: t("kindFinished"),
    resale: t("kindResale"),
  };
  const channelLabel: Record<SalesChannel, string> = {
    online: t("onlineOnly"),
    in_store: t("inStoreOnly"),
    both: t("both"),
  };
  const totalStock = product?.stock.reduce((sum, s) => sum + s.qty, 0) ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={120} defaultValue={product?.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sku">{t("sku")}</Label>
        <Input
          id="sku"
          name="sku"
          maxLength={60}
          placeholder={t("skuPlaceholder")}
          defaultValue={product?.sku}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="kind">{t("kind")}</Label>
        <Select name="kind" defaultValue={product?.kind ?? "resale"}>
          <SelectTrigger id="kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {kindLabel[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Input
          id="description"
          name="description"
          maxLength={500}
          defaultValue={product?.description ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unit">{t("unit")}</Label>
        <Input
          id="unit"
          name="unit"
          required
          maxLength={30}
          defaultValue={product?.unit ?? "unidad"}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="min_stock">{t("minStock")}</Label>
        <Input
          id="min_stock"
          name="min_stock"
          type="number"
          min={0}
          step="0.001"
          required
          defaultValue={product?.minStock ?? 0}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cost">{t("cost")}</Label>
        <Input
          id="cost"
          name="cost"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={product?.cost ?? 0}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="price">{t("price")}</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={product?.price}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="discount_percent">{t("discountPercent")}</Label>
        <Input
          id="discount_percent"
          name="discount_percent"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={product?.discountPercent ?? 0}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tax_rate">{t("taxRate", { country: DEFAULT_TAX_COUNTRY_LABEL })}</Label>
        <Input
          id="tax_rate"
          name="tax_rate"
          type="number"
          min={0}
          max={100}
          step="0.01"
          required
          defaultValue={product?.taxRate ?? DEFAULT_TAX_RATE_PERCENT}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sales_channel">{t("whereSold")}</Label>
        <Select name="sales_channel" defaultValue={product?.salesChannel ?? "both"}>
          <SelectTrigger id="sales_channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {channelLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CategoryPicker categories={categories} defaultCategoryId={product?.categoryId} />
      {product ? (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          {t("totalStock")}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {totalStock.toLocaleString("es-CO")}
          </span>
          {product.stock.length > 0
            ? ` (${product.stock.map((s) => `${s.warehouseName}: ${s.qty.toLocaleString("es-CO")}`).join(" · ")})`
            : null}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="photo">{product ? t("replacePhoto") : t("photo")}</Label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm"
        />
      </div>
    </div>
  );
}
