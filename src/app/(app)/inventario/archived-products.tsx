import { getTranslations } from "next-intl/server";

import { toggleProductActive } from "@/actions/products";
import { Button } from "@/components/ui/button";

/**
 * S19-25/S19-26: "Eliminar" en cada inventario/Catálogo es borrado lógico (active=false). Acá se listan los
 * eliminados para poder reactivarlos; al reactivar vuelven a Productos y (si se venden) al Catálogo.
 */
export async function ArchivedProducts({
  products,
}: {
  products: { id: string; sku: string | null; name: string | null }[];
}) {
  if (products.length === 0) return null;
  const t = await getTranslations("inventory");

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">{t("archived")}</h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {p.name} <span className="text-xs">· {p.sku}</span>
            </span>
            <form action={toggleProductActive}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="active" value="true" />
              <Button type="submit" variant="outline" size="sm">
                {t("reactivate")}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
