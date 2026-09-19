"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { createProduct, updateProduct } from "@/actions/products";
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

const KIND_LABEL = { raw: "Materia prima", finished: "Terminado", resale: "Reventa" } as const;

export type ProductFormValues = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  kind: keyof typeof KIND_LABEL;
  cost: number | null;
  price: number | null;
  tax_rate: number | null;
  min_stock: number;
  active: boolean;
};

type Warehouse = { id: string; name: string };

const PRODUCTS_PATH = "/inventario/productos";

export function ProductForm({
  values,
  warehouses,
}: {
  values?: Partial<ProductFormValues>;
  /** Habilita el bloque "Stock inicial" (S13-01) — solo tiene sentido en modo creación. */
  warehouses?: Warehouse[];
}) {
  const isEditing = values?.id != null;
  const router = useRouter();
  const [state, formAction, pending] = useActionState(isEditing ? updateProduct : createProduct, null);
  // router.push es un efecto secundario de navegación (no un setState de UI): va en useEffect,
  // no en el ajuste de estado durante el render (React advierte "setState en render" si un
  // componente hijo como Link lo dispara aquí).
  useEffect(() => {
    if (state?.ok && isEditing) router.push(PRODUCTS_PATH);
  }, [state, isEditing, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required maxLength={60} defaultValue={values?.sku} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required maxLength={120} defaultValue={values?.name} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-3">
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            name="description"
            maxLength={500}
            defaultValue={values?.description ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="unit">Unidad</Label>
          <Input
            id="unit"
            name="unit"
            required
            maxLength={30}
            defaultValue={values?.unit ?? "unidad"}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">Tipo</Label>
          <Select name="kind" defaultValue={values?.kind ?? "raw"}>
            <SelectTrigger id="kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="min_stock">Stock mínimo</Label>
          <Input
            id="min_stock"
            name="min_stock"
            type="number"
            min={0}
            step="0.001"
            required
            defaultValue={values?.min_stock ?? 0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cost">Costo</Label>
          <Input
            id="cost"
            name="cost"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={values?.cost ?? 0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Precio de venta</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={values?.price ?? 0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tax_rate">IVA %</Label>
          <Input
            id="tax_rate"
            name="tax_rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={values?.tax_rate ?? 19}
          />
        </div>
      </div>

      {!values?.id && warehouses && warehouses.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
          <div>
            <p className="text-sm font-medium">Stock inicial (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Registra la cantidad con la que arranca el producto. Se usa el Costo de arriba como
              costo del ingreso.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="warehouse_id">Bodega</Label>
              <Select name="warehouse_id">
                <SelectTrigger id="warehouse_id" className="w-full">
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
              <Label htmlFor="initial_qty">Cantidad</Label>
              <Input id="initial_qty" name="initial_qty" type="number" min={0} step="0.001" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (isEditing ? "Guardando…" : "Creando…") : isEditing ? "Guardar cambios" : "Crear producto"}
        </Button>
        {isEditing ? (
          <Button asChild variant="ghost">
            <Link href={PRODUCTS_PATH}>Cancelar</Link>
          </Button>
        ) : null}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
