import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { Button } from "@/components/ui/button";

import { RecipeForm } from "./recipe-form";

export async function generateMetadata() {
  const t = await getTranslations("catalog");
  return { title: `${t("recipe")} · Miel` };
}

interface RecetaPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecetaPage({ params }: RecetaPageProps) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const { id: productId } = await params;
  const supabase = await createClient();
  
  // 1. Get product
  const { data: product } = await supabase
    .from("products_catalog")
    .select("id, name, kind")
    .eq("id", productId)
    .single();

  if (!product || product.kind !== "finished") notFound();
  const t = await getTranslations("recipes");

  // 2. Get recipe items
  const { data: recipeItems } = await supabase
    .from("recipe_items")
    .select("component_product_id, qty")
    .eq("product_id", productId);

  // 3. Get all raw/resale products for the select dropdown
  const { data: availableComponents } = await supabase
    .from("products_catalog")
    .select("id, name, sku, unit, kind")
    // S19-26: insumos = materias primas y reventa; nunca oficina, mobiliario, vehículos, etc.
    .in("kind", ["raw", "resale"])
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
          <Link href="/inventario/productos">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("back")}
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{t("title", { name: product.name ?? "" })}</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      <RecipeForm 
        productId={product.id as string}
        initialItems={(recipeItems as { component_product_id: string; qty: number }[]) ?? []}
        availableComponents={(availableComponents as { id: string; name: string; sku: string; unit: string; kind: string }[]) ?? []}
      />
    </div>
  );
}
