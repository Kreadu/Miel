import type { InventoryId } from "@/lib/inventories";
import type { WarehouseStock } from "@/lib/stock";

export type ProductKind = "raw" | "finished" | "resale" | "other";
export type SalesChannel = "online" | "in_store" | "both";
export type Category = { id: string; name: string };
export type Warehouse = { id: string; name: string };
/** S19-32: en Inventario se editan stock por bodega y stock mínimo; en Vender solo se ven. */
export type ProductFormMode = "inventory" | "sales";

/** S19-24: un producto tal como lo muestran Inventario y Catálogo (misma tarjeta y formulario). */
export type ProductView = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  kind: ProductKind;
  /** null para member (products_catalog enmascara el costo). */
  cost: number | null;
  price: number;
  taxRate: number;
  minStock: number;
  discountPercent: number;
  salesChannel: SalesChannel;
  categoryId: string | null;
  categoryName: string | null;
  photoUrl: string | null;
  stock: WarehouseStock[];
  /** S19-26: inventario + datos de vehículos/mobiliario/herramientas. */
  inventory: InventoryId;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  serialNumber: string | null;
  vehicleYear: number | null;
  purchaseDate: string | null;
  /** S19-35: peso en kg (envío por transporte). */
  weightKg: number;
};
