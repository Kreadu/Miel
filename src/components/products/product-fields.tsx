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
import {
  type AssetField,
  type InventoryId,
  inventoryById,
} from "@/lib/inventories";
import {
  DEFAULT_TAX_COUNTRY_LABEL,
  DEFAULT_TAX_RATE_PERCENT,
} from "@/lib/validation/catalog";

import { CategoryPicker } from "./category-picker";
import type {
  Category,
  ProductFormMode,
  ProductKind,
  ProductView,
  SalesChannel,
  Warehouse,
} from "./types";

const SALE_KINDS: ProductKind[] = ["finished", "resale"];
const CHANNELS: SalesChannel[] = ["online", "in_store", "both"];

const ASSET_INPUT: Record<AssetField, { type: string; max?: number }> = {
  plate: { type: "text", max: 20 },
  brand: { type: "text", max: 80 },
  model: { type: "text", max: 80 },
  vehicle_year: { type: "number" },
  color: { type: "text", max: 40 },
  serial_number: { type: "text", max: 80 },
  purchase_date: { type: "date" },
};

function assetValue(
  product: ProductView | undefined,
  field: AssetField,
): string {
  if (!product) return "";
  const byField: Record<AssetField, string | number | null> = {
    plate: product.plate,
    brand: product.brand,
    model: product.model,
    vehicle_year: product.vehicleYear,
    color: product.color,
    serial_number: product.serialNumber,
    purchase_date: product.purchaseDate,
  };
  return byField[field]?.toString() ?? "";
}

/**
 * S19-24/S19-26: campos del formulario único (todos los inventarios y el Catálogo). Precio,
 * descuento, IVA, canal y tipo solo en el inventario que se vende; vehículos/mobiliario/
 * herramientas suman sus datos propios. S19-32: el stock de cada bodega o sucursal y el stock
 * mínimo se editan en Inventario (`mode="inventory"`); en Vender solo se muestran.
 */
export function ProductFields({
  mode,
  inventory,
  product,
  categories,
  warehouses,
}: {
  mode: ProductFormMode;
  inventory: InventoryId;
  warehouses: Warehouse[];
  /** Al editar; sin producto es un alta. */
  product?: ProductView;
  categories: Category[];
}) {
  const t = useTranslations("catalog");
  const config = inventoryById(inventory);
  const kindLabel: Record<ProductKind, string> = {
    raw: t("kindRaw"),
    finished: t("kindFinished"),
    resale: t("kindResale"),
    other: t("kindOther"),
  };
  const channelLabel: Record<SalesChannel, string> = {
    online: t("onlineOnly"),
    in_store: t("inStoreOnly"),
    both: t("both"),
  };
  const editable = mode === "inventory";
  const stock = product?.stock ?? [];
  const totalStock = stock.reduce((sum, s) => sum + s.qty, 0);
  const qtyAt = (warehouseId: string) =>
    stock.filter((s) => s.warehouseId === warehouseId).reduce((sum, s) => sum + s.qty, 0);
  // Bodegas archivadas que todavía tienen stock: se muestran, pero no se editan.
  const archivedWithStock = stock.filter((s) => !warehouses.some((w) => w.id === s.warehouseId));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={product?.name}
        />
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
      <input type="hidden" name="inventory" value={inventory} />
      {config.sellable ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">{t("kind")}</Label>
          <Select
            name="kind"
            defaultValue={product?.kind === "finished" ? "finished" : "resale"}
          >
            <SelectTrigger id="kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {kindLabel[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <input type="hidden" name="kind" value={config.fixedKind ?? "other"} />
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Input
          id="description"
          name="description"
          maxLength={500}
          defaultValue={product?.description ?? ""}
        />
      </div>
      {config.assetFields.map((f) => (
        <div key={f} className="flex flex-col gap-2">
          <Label htmlFor={f}>{t(`asset_${f}`)}</Label>
          <Input
            id={f}
            name={f}
            type={ASSET_INPUT[f].type}
            maxLength={ASSET_INPUT[f].max}
            {...(f === "vehicle_year" ? { min: 1900, max: 2100, step: 1 } : {})}
            defaultValue={assetValue(product, f)}
          />
        </div>
      ))}
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
      {config.sellable ? (
        <>
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
            <Label htmlFor="tax_rate">
              {t("taxRate", { country: DEFAULT_TAX_COUNTRY_LABEL })}
            </Label>
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
            <Select
              name="sales_channel"
              defaultValue={product?.salesChannel ?? "both"}
            >
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
        </>
      ) : null}
      <CategoryPicker
        inventory={inventory}
        categories={categories}
        defaultCategoryId={product?.categoryId}
      />
      {/* S19-32: stock mínimo y stock de cada bodega o sucursal en una misma grilla alineada
          (items-end: los campos quedan al mismo nivel aunque un nombre ocupe dos líneas). */}
      <fieldset className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium">{t("stockByWarehouse")}</legend>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StockCell
            id="min_stock"
            label={t("minStock")}
            value={product?.minStock ?? 0}
            editable={editable}
          />
          {warehouses.map((w) => (
            <StockCell
              key={w.id}
              id={`stock__${w.id}`}
              label={w.name}
              value={qtyAt(w.id)}
              editable={editable}
            />
          ))}
          {archivedWithStock.map((s) => (
            <StockCell
              key={s.warehouseId}
              id={`archived__${s.warehouseId}`}
              label={s.warehouseName}
              value={s.qty}
              editable={false}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("totalStock")}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {totalStock.toLocaleString("es-CO")}
          </span>
          {editable ? ` · ${t("stockEditHint")}` : ` · ${t("stockReadOnlyHint")}`}
        </p>
      </fieldset>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="photo">
          {product ? t("replacePhoto") : t("photo")}
        </Label>
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

/** Un campo de stock: input en Inventario, caja de solo lectura del mismo tamaño en Vender. */
function StockCell({
  id,
  label,
  value,
  editable,
}: {
  id: string;
  label: string;
  value: number;
  editable: boolean;
}) {
  if (editable) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} name={id} type="number" min={0} step="0.001" defaultValue={value} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <p className="flex h-9 items-center justify-end rounded-md border border-input bg-muted px-3 text-sm tabular-nums">
        {value.toLocaleString("es-CO")}
      </p>
    </div>
  );
}
