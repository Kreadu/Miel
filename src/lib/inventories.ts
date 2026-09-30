/**
 * S19-26: tipos de inventario. Todos viven en `products` (columna `inventory`) y heredan stock
 * por bodega o sucursal, movimientos, kardex, stock mínimo, alertas y compras. Solo
 * "productos" se vende (Catálogo/Pedidos) y tiene receta.
 */
export const INVENTORY_IDS = [
  "productos",
  "materias_primas",
  "articulos_oficina",
  "mobiliario",
  "vehiculos",
  "herramientas",
  "aseo",
] as const;

export type InventoryId = (typeof INVENTORY_IDS)[number];

export const ASSET_FIELDS = [
  "plate",
  "brand",
  "model",
  "vehicle_year",
  "color",
  "serial_number",
  "purchase_date",
] as const;

export type AssetField = (typeof ASSET_FIELDS)[number];

export type InventoryConfig = {
  id: InventoryId;
  /** Segmento de URL bajo /inventario. */
  slug: string;
  /** Se vende: precio, descuento, IVA, canal, tipo terminado/reventa, Catálogo y receta. */
  sellable: boolean;
  /** kind fijo para inventarios que no se venden (null = se elige terminado/reventa). */
  fixedKind: "raw" | "other" | null;
  assetFields: readonly AssetField[];
};

const ASSET_BASIC = ["brand", "model", "serial_number", "purchase_date"] as const;

export const INVENTORIES: readonly InventoryConfig[] = [
  {
    id: "productos",
    slug: "productos",
    sellable: true,
    fixedKind: null,
    assetFields: [],
  },
  {
    id: "materias_primas",
    slug: "materias-primas",
    sellable: false,
    fixedKind: "raw",
    assetFields: [],
  },
  {
    id: "articulos_oficina",
    slug: "articulos-oficina",
    sellable: false,
    fixedKind: "other",
    assetFields: [],
  },
  {
    id: "mobiliario",
    slug: "mobiliario",
    sellable: false,
    fixedKind: "other",
    assetFields: ASSET_BASIC,
  },
  {
    id: "vehiculos",
    slug: "vehiculos",
    sellable: false,
    fixedKind: "other",
    assetFields: ASSET_FIELDS,
  },
  {
    id: "herramientas",
    slug: "herramientas",
    sellable: false,
    fixedKind: "other",
    assetFields: ASSET_BASIC,
  },
  {
    id: "aseo",
    slug: "aseo",
    sellable: false,
    fixedKind: "other",
    assetFields: [],
  },
];

export function inventoryById(id: string): InventoryConfig {
  return INVENTORIES.find((i) => i.id === id) ?? INVENTORIES[0];
}

export function inventoryBySlug(slug: string): InventoryConfig | undefined {
  return INVENTORIES.find((i) => i.slug === slug);
}

export function inventoryPath(inv: InventoryConfig): string {
  return `/inventario/${inv.slug}`;
}

/** El inventario manda sobre el tipo: solo "productos" elige terminado/reventa. */
export function resolveKind(
  inventory: InventoryId,
  requested: "raw" | "finished" | "resale" | "other",
): "raw" | "finished" | "resale" | "other" {
  const fixed = inventoryById(inventory).fixedKind;
  if (fixed) return fixed;
  return requested === "finished" ? "finished" : "resale";
}
