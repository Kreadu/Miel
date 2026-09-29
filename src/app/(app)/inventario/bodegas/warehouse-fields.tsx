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
};

const DETAIL_FIELDS = [
  { name: "address", label: "Dirección", max: 200, wide: true },
  { name: "department", label: "Departamento", max: 80 },
  { name: "city", label: "Ciudad", max: 80 },
  { name: "country", label: "País", max: 80 },
  { name: "postal_code", label: "Código postal", max: 20 },
  { name: "phone", label: "Teléfono", max: 30, type: "tel" },
  { name: "whatsapp", label: "WhatsApp", max: 30, type: "tel" },
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
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Nombre de la bodega o sucursal</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values?.name}
        />
      </div>
      {DETAIL_FIELDS.map((f) => (
        <div key={f.name} className={`flex flex-col gap-2 ${"wide" in f ? "sm:col-span-2" : ""}`}>
          <Label htmlFor={`${idPrefix}-${f.name}`}>{f.label}</Label>
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
export function warehouseSummary(w: WarehouseDetails): string {
  return [w.address, w.city, w.department, w.country, w.postal_code, w.phone && `Tel. ${w.phone}`, w.whatsapp && `WhatsApp ${w.whatsapp}`]
    .filter(Boolean)
    .join(" · ");
}
