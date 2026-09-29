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

import { CategoryPicker } from "./category-picker";

const SALES_CHANNELS = ["online", "in_store", "both"] as const;

export function CatalogProductFields({
  defaultName,
  defaultDescription,
  defaultPrice,
  defaultDiscountPercent,
  defaultSalesChannel = "both",
  defaultCategoryId,
  isEditing = false,
  stock,
  categories = [],
}: {
  defaultName?: string;
  defaultDescription?: string | null;
  defaultPrice?: number;
  defaultDiscountPercent?: number;
  defaultSalesChannel?: (typeof SALES_CHANNELS)[number];
  defaultCategoryId?: string | null;
  isEditing?: boolean;
  /**
   * S19-17/S19-20: stock por bodega o sucursal, solo lectura al editar. La cantidad viene de los
   * movimientos de cada bodega o sucursal; no se carga desde el catálogo.
   */
  stock?: { warehouseName: string; qty: number }[];
  /** S19-15/S19-16: categorías del tenant; el "+" del selector crea una nueva acá mismo. */
  categories?: { id: string; name: string }[];
}) {
  const t = useTranslations("catalog");
  const channelLabel: Record<(typeof SALES_CHANNELS)[number], string> = {
    online: t("onlineOnly"),
    in_store: t("inStoreOnly"),
    both: t("both"),
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={120} defaultValue={defaultName} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Input
          id="description"
          name="description"
          maxLength={500}
          defaultValue={defaultDescription ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">{t("price")}</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultPrice}
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
            defaultValue={defaultDiscountPercent ?? 0}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sales_channel">{t("whereSold")}</Label>
        <Select name="sales_channel" defaultValue={defaultSalesChannel}>
          <SelectTrigger id="sales_channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SALES_CHANNELS.map((value) => (
              <SelectItem key={value} value={value}>
                {channelLabel[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CategoryPicker categories={categories} defaultCategoryId={defaultCategoryId} />
      {stock ? (
        <p className="text-sm text-muted-foreground">
          {t("totalStock")}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {stock.reduce((sum, s) => sum + s.qty, 0).toLocaleString("es-CO")}
          </span>
          {stock.length > 0
            ? ` (${stock.map((s) => `${s.warehouseName}: ${s.qty.toLocaleString("es-CO")}`).join(" · ")})`
            : null}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="photo">{isEditing ? t("replacePhoto") : t("photo")}</Label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm"
        />
      </div>
    </>
  );
}
