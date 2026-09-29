import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { RateForm } from "./rate-form";
import { RateRow } from "./rate-row";

export const metadata = { title: "Envíos · Miel" };

/**
 * S19-35: tipos de transporte y sus tarifas (base + por kg + por km). En el pedido, "Envío por
 * transporte" muestra una opción por cada uno con su valor según el peso y los km.
 */
export default async function EnviosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const canManage = active.role !== "member";

  const supabase = await createClient();
  const { data: rates } = await supabase
    .from("shipping_rates")
    .select("id, name, base_price, price_per_kg, price_per_km")
    .order("name", { ascending: true });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Envíos</h1>
        <p className="text-sm text-muted-foreground">
          Tus transportes y sus tarifas. Valor del envío = base + (valor por kg × peso del pedido) +
          (valor por km × km).
        </p>
      </div>

      {canManage ? <RateForm /> : null}

      {rates && rates.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {rates.map((r) => (
            <RateRow key={r.id} id={r.id} values={r} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes transportes. Agrega hasta 3 (por ejemplo Moto, Camioneta y Transportadora)."
            : "Aún no hay transportes configurados."}
        </p>
      )}
    </div>
  );
}
