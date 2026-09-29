import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { OpenSessionForm } from "../caja/open-session-form";
import { PosTerminal } from "./pos-terminal";

export const metadata = { title: "Punto de Venta · Miel" };

export default async function PosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [productsRes, warehousesRes, customersRes, sessionRes] = await Promise.all([
    // products_catalog, nunca la tabla base products: price/cost/tax_rate solo se leen por la
    // vista (grant columnar de la tabla base los excluye a propósito, S2-02/ADR-029).
    // S19-05: POS es canal físico — solo productos marcados "in_store" o "both".
    supabase
      .from("products_catalog")
      .select("id, name, price, tax_rate, sku")
      .eq("tenant_id", active.tenantId)
      .eq("active", true)
      .in("sales_channel", ["in_store", "both"])
      .order("name"),
    supabase
      .from("warehouses")
      .select("id, name")
      .eq("tenant_id", active.tenantId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("customers")
      .select("id, name")
      .eq("tenant_id", active.tenantId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("cash_sessions")
      .select("id")
      .eq("tenant_id", active.tenantId)
      .eq("opened_by", user.id)
      .eq("status", "open")
      .maybeSingle(),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (warehousesRes.error) throw warehousesRes.error;
  if (customersRes.error) throw customersRes.error;
  if (sessionRes.error) throw sessionRes.error;

  const hasOpenSession = !!sessionRes.data;

  // La vista tipa price/tax_rate como nullable (columna de vista); en products_catalog member
  // ya los recibe reales (ADR-029), solo cost sigue enmascarado — normalizamos igual por si
  // algún producto legado quedó con el default null antes de existir la columna.
  const products = (productsRes.data ?? [])
    .filter((p) => p.id && p.name && p.sku)
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      sku: p.sku as string,
      price: p.price ?? 0,
      tax_rate: p.tax_rate ?? 0,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Punto de Venta</h1>
        <p className="text-sm text-muted-foreground">Registra ventas de mostrador de forma rápida.</p>
      </div>

      {!hasOpenSession ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground max-w-sm">
            Para vender primero abrí tu turno de caja: poné con cuánto efectivo arrancás.
          </p>
          <OpenSessionForm />
        </div>
      ) : (
        <PosTerminal
          products={products}
          warehouses={warehousesRes.data || []}
          customers={customersRes.data || []}
        />
      )}
    </div>
  );
}
