import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type WarehouseDetails = {
  name: string;
  address: string | null;
  department: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  whatsapp: string | null;
  /** S18-10: presta stock para completar ventas de otras bodegas. */
  lends_stock?: boolean;
};

const DETAIL_FIELDS = [
  { name: "address", max: 200, wide: true },
  { name: "department", max: 80 },
  { name: "city", max: 80 },
  { name: "country", max: 80 },
  { name: "postal_code", max: 20 },
  { name: "phone", max: 30, type: "tel" },
  { name: "whatsapp", max: 30, type: "tel" },
] as const;

/** S19-18: nombre + ubicación/contacto de una bodega o sucursal (alta y edición). */
export function WarehouseFields({
  idPrefix,
  values,
}: {
  /** Evita ids duplicados cuando hay varios formularios en la misma página. */
  idPrefix: string;
  values?: WarehouseDetails;
}) {
  const t = useTranslations("warehouses");
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>{t("name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values?.name}
        />
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="lends_stock"
          defaultChecked={values?.lends_stock ?? false}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>
          <span className="font-medium">{t("lendsStock")}</span>
          <span className="block text-xs text-muted-foreground">{t("lendsStockHelp")}</span>
        </span>
      </label>
      {DETAIL_FIELDS.map((f) => (
        <div key={f.name} className={`flex flex-col gap-2 ${"wide" in f ? "sm:col-span-2" : ""}`}>
          <Label htmlFor={`${idPrefix}-${f.name}`}>{t(`fields.${f.name}`)}</Label>
          <Input
            id={`${idPrefix}-${f.name}`}
            name={f.name}
            type={"type" in f ? f.type : "text"}
            maxLength={f.max}
            defaultValue={values?.[f.name] ?? ""}
          />
        </div>
      ))}
    </div>
  );
}

/** Resumen de una línea con los datos cargados (para el listado). */
export function warehouseSummary(w: WarehouseDetails, tel: (phone: string) => string): string {
  return [w.address, w.city, w.department, w.country, w.postal_code, w.phone && tel(w.phone), w.whatsapp && `WhatsApp ${w.whatsapp}`]
    .filter(Boolean)
    .join(" · ");
}
