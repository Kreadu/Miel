import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RateValues = {
  name: string;
  base_price: number;
  price_per_kg: number;
  price_per_km: number;
};

const FIELDS = [
  { name: "base_price", label: "Valor base" },
  { name: "price_per_kg", label: "Valor por kg" },
  { name: "price_per_km", label: "Valor por km" },
] as const;

/** S19-35: nombre + tarifa (base + por kg + por km) de un transporte. */
export function RateFields({ idPrefix, values }: { idPrefix: string; values?: RateValues }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Transporte</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={60}
          placeholder="Ej. Moto"
          defaultValue={values?.name}
        />
      </div>
      {FIELDS.map((f) => (
        <div key={f.name} className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-${f.name}`}>{f.label}</Label>
          <Input
            id={`${idPrefix}-${f.name}`}
            name={f.name}
            type="number"
            min={0}
            step="0.01"
            defaultValue={values?.[f.name] ?? 0}
          />
        </div>
      ))}
    </div>
  );
}
