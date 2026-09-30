import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_MODULES } from "@/lib/rrhh/workers";

/** S21-02: nombre de la categoría + módulos que ve (casillas). */
export function CategoryFields({
  idPrefix,
  name,
  modules = [],
}: {
  idPrefix: string;
  name?: string;
  modules?: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor={`${idPrefix}-name`}>Nombre de la categoría</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={60}
          placeholder="Ej. Vendedor"
          defaultValue={name}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Qué puede ver</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {CATEGORY_MODULES.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="modules"
                value={m.id}
                defaultChecked={modules.includes(m.id)}
                className="h-4 w-4 accent-primary"
              />
              {m.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Gastos y RRHH son solo para administradores (invítalos por correo como Administrador).
        </p>
      </fieldset>
    </div>
  );
}
