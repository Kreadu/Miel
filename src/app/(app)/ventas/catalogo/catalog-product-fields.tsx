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

const SALES_CHANNELS = ["online", "in_store", "both"] as const;

// El <Select> nativo no admite value="" (Radix la reserva para "sin selección") — mismo
// sentinel que ya usa el resto de la app (NO_CUSTOMER en SaleForm/CatalogPedidoCart).
const NO_CATEGORY = "__none__";

export function CatalogProductFields({
  defaultName,
  defaultDescription,
  defaultPrice,
  defaultDiscountPercent,
  defaultSalesChannel = "both",
  defaultCategoryId,
  isEditing = false,
  warehouses = [],
  categories = [],
}: {
  defaultName?: string;
  defaultDescription?: string | null;
  defaultPrice?: number;
  defaultDiscountPercent?: number;
  defaultSalesChannel?: (typeof SALES_CHANNELS)[number];
  defaultCategoryId?: string | null;
  isEditing?: boolean;
  /** S19-14: bodegas/sucursales/tiendas activas del tenant, para cargar stock desde acá. */
  warehouses?: { id: string; name: string }[];
  /** S19-15: categorías existentes del tenant, para asignar o crear una nueva acá mismo. */
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category_id">{t("category")}</Label>
          <Select name="category_id" defaultValue={defaultCategoryId || NO_CATEGORY}>
            <SelectTrigger id="category_id" className="w-full">
              <SelectValue placeholder={t("noCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>{t("noCategory")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_category_name">{t("newCategoryLabel")}</Label>
          <Input id="new_category_name" name="new_category_name" maxLength={60} />
        </div>
      </div>
      {warehouses.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
          <div>
            <p className="text-sm font-medium">{t("stock")}</p>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? "Elegí una bodega/sucursal/tienda para sumarle cantidad a lo que ya tiene."
                : "Elegí en qué bodega/sucursal/tienda está y cuánta cantidad hay."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="warehouse_id">Bodega / sucursal / tienda</Label>
              <Select name="warehouse_id">
                <SelectTrigger id="warehouse_id" className="w-full">
                  <SelectValue placeholder="Selecciona una" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stock_qty">Cantidad</Label>
              <Input id="stock_qty" name="stock_qty" type="number" min={0} step="0.001" />
            </div>
          </div>
        </div>
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
