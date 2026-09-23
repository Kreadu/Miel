"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerProduction } from "@/actions/production";

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; sku: string; unit: string; kind: string };
type RecipeItem = { product_id: string; component_product_id: string; qty: number };

type ProductionItem = {
  product_id: string;
  qty: number;
};

export function ProductionForm({
  warehouses,
  products,
  recipes,
}: {
  warehouses: Warehouse[];
  products: Product[];
  recipes: RecipeItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [outputQty, setOutputQty] = useState<number>(1);
  const [consumptions, setConsumptions] = useState<ProductionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const finishedProducts = products.filter((p) => p.kind === "finished");
  const rawProducts = products; // It can be 'raw' or 'finished' components

  const handleProductChange = (val: string) => {
    setProductId(val);
    // Pre-fill consumptions based on recipe
    const productRecipes = recipes.filter((r) => r.product_id === val);
    if (productRecipes.length > 0) {
      setConsumptions(
        productRecipes.map((r) => ({
          product_id: r.component_product_id,
          qty: r.qty * outputQty,
        }))
      );
    } else {
      setConsumptions([]);
    }
  };

  const handleOutputQtyChange = (val: number) => {
    setOutputQty(val);
    if (productId) {
      // Re-calculate recipe scaling
      const productRecipes = recipes.filter((r) => r.product_id === productId);
      if (productRecipes.length > 0) {
        setConsumptions(
          productRecipes.map((r) => ({
            product_id: r.component_product_id,
            qty: r.qty * val,
          }))
        );
      }
    }
  };

  const handleAddConsumption = () => {
    setConsumptions([...consumptions, { product_id: "", qty: 1 }]);
  };

  const handleRemoveConsumption = (idx: number) => {
    setConsumptions(consumptions.filter((_, i) => i !== idx));
  };

  const handleChangeConsumption = (idx: number, field: keyof ProductionItem, val: string | number) => {
    const newItems = [...consumptions];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setConsumptions(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!warehouseId || !productId || outputQty <= 0) {
      setError("Datos de producción incompletos.");
      return;
    }

    if (consumptions.length === 0) {
      setError("Debes agregar al menos un insumo.");
      return;
    }

    if (consumptions.some((c) => !c.product_id || c.qty <= 0)) {
      setError("Insumos inválidos: selecciona un producto y cantidad > 0.");
      return;
    }

    startTransition(async () => {
      const result = await registerProduction({
        warehouse_id: warehouseId,
        product_id: productId,
        output_qty: outputQty,
        consumptions,
      });

      if (result && !result.ok) {
        setError(result.error);
      } else if (result?.ok) {
        setSuccess("Producción registrada correctamente.");
        router.refresh();
        // Reset form
        setProductId("");
        setOutputQty(1);
        setConsumptions([]);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-4xl">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label>Bodega destino / origen</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una bodega" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Producto a fabricar</Label>
          <Select value={productId} onValueChange={handleProductChange} required>
            <SelectTrigger>
              <SelectValue placeholder="Producto terminado" />
            </SelectTrigger>
            <SelectContent>
              {finishedProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Cantidad a fabricar</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0.001"
              step="0.001"
              required
              value={outputQty || ""}
              onChange={(e) => handleOutputQtyChange(parseFloat(e.target.value) || 0)}
            />
            <span className="text-sm text-muted-foreground w-12">
              {productId ? products.find((p) => p.id === productId)?.unit : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Insumos Consumidos</h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddConsumption}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar insumo manual
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
          {consumptions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay insumos. Selecciona un producto con receta o agrega insumos manualmente.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 font-medium">Insumo</th>
                  <th className="px-4 py-3 font-medium text-right w-40">Cantidad</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {consumptions.map((item, idx) => {
                  const comp = rawProducts.find((p) => p.id === item.product_id);
                  return (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Select
                          value={item.product_id}
                          onValueChange={(val) => handleChangeConsumption(idx, "product_id", val)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar insumo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {rawProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            required
                            className="w-24 text-right"
                            value={item.qty}
                            onChange={(e) =>
                              handleChangeConsumption(idx, "qty", parseFloat(e.target.value) || 0)
                            }
                          />
                          <span className="text-xs text-muted-foreground w-8 text-left truncate">
                            {comp ? comp.unit : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveConsumption(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 mt-4">
        {error && <span className="text-sm text-destructive">{error}</span>}
        {success && <span className="text-sm text-green-600">{success}</span>}
        <Button type="submit" size="lg" disabled={pending || consumptions.length === 0}>
          {pending ? "Registrando..." : "Registrar Producción"}
        </Button>
      </div>
    </form>
  );
}
