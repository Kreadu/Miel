import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { Button } from "@/components/ui/button";

import { RecipeForm } from "./recipe-form";

export const metadata = { title: "Receta · Miel" };

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

  // 2. Get recipe items
  const { data: recipeItems } = await supabase
    .from("recipe_items")
    .select("component_product_id, qty")
    .eq("product_id", productId);

  // 3. Get all raw/resale products for the select dropdown
  const { data: availableComponents } = await supabase
    .from("products_catalog")
    .select("id, name, sku, unit, kind")
    .neq("kind", "finished")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
          <Link href="/inventario/productos">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver a productos
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Receta: {product.name}</h1>
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
