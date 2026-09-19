import { createClient } from "@/lib/supabase/server";
import { ProductionForm } from "./production-form";


export const metadata = { title: "Registro de Producción · Miel" };

export default async function ProduccionPage() {
  const supabase = await createClient();

  const [productsRes, warehousesRes, recipesRes] = await Promise.all([
    supabase.from("products").select("id, name, sku, unit, kind").eq("active", true).order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
    supabase.from("recipe_items").select("product_id, component_product_id, qty"),
  ]);

  if (productsRes.error || warehousesRes.error || recipesRes.error) {
    console.error("Error fetching production data", {
      products: productsRes.error,
      warehouses: warehousesRes.error,
      recipes: recipesRes.error,
    });
    return (
      <div className="p-8 text-center text-destructive">
        Error al cargar los datos para registrar producción.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registro de Producción</h1>
        <p className="text-muted-foreground mt-2">
          Registra la fabricación de productos terminados consumiendo insumos de tu bodega.
        </p>
      </div>

      <ProductionForm
        products={productsRes.data}
        warehouses={warehousesRes.data}
        recipes={recipesRes.data}
      />
    </div>
  );
}
