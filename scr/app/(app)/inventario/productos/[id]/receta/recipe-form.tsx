"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveRecipe } from "@/actions/recipes";

type RecipeItem = {
  component_product_id: string;
  qty: number;
};

type AvailableComponent = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  kind: string;
};

export function RecipeForm({
  productId,
  initialItems,
  availableComponents,
}: {
  productId: string;
  initialItems: { component_product_id: string; qty: number }[];
  availableComponents: AvailableComponent[];
}) {
  const [items, setItems] = useState<RecipeItem[]>(initialItems);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAdd = () => {
    setItems([...items, { component_product_id: "", qty: 1 }]);
  };

  const handleRemove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof RecipeItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value } as RecipeItem;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (items.some((i) => !i.component_product_id)) {
      setError("Por favor selecciona un insumo en todas las filas.");
      return;
    }

    startTransition(async () => {
      const result = await saveRecipe(productId, items);
      if (!result.success) {
        setError(result.message || "Error al guardar la receta");
      } else {
        router.push("/inventario/productos");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay insumos en esta receta. Haz clic en &quot;Añadir insumo&quot; para empezar.
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
              {items.map((item, idx) => {
                const comp = availableComponents.find((c) => c.id === item.component_product_id);
                return (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Select
                        value={item.component_product_id}
                        onValueChange={(val) => handleChange(idx, "component_product_id", val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar insumo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableComponents.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({c.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          required
                          className="w-24 text-right"
                          value={item.qty}
                          onChange={(e) => handleChange(idx, "qty", parseFloat(e.target.value) || 0)}
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
                        onClick={() => handleRemove(idx)}
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

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir insumo
        </Button>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {error && <span className="text-sm text-destructive mr-2">{error}</span>}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar receta"}
          </Button>
        </div>
      </div>
    </form>
  );
}
