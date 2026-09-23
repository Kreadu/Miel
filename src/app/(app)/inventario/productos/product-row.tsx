import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoney as baseFormatMoney } from "@/lib/format";

import { ArchiveProductAction } from "./archive-product-action";
import { type ProductFormValues } from "./product-form";

const KIND_LABEL = { raw: "Materia prima", finished: "Terminado", resale: "Reventa" } as const;

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return baseFormatMoney(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ProductRow({
  product,
  canManage,
}: {
  product: ProductFormValues;
  canManage: boolean;
}) {
  return (
    <tr className="border-b border-border text-sm last:border-0">
      <td className={`px-3 py-2.5 ${product.active ? "" : "text-muted-foreground line-through"}`}>
        {product.sku}
      </td>
      <td className={`px-3 py-2.5 ${product.active ? "" : "text-muted-foreground line-through"}`}>
        {product.name}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{KIND_LABEL[product.kind]}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(product.price)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{product.min_stock}</td>
      <td className="px-3 py-2.5">
        {canManage ? (
          <div className="flex items-center justify-end gap-1">
            {product.kind === "finished" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/inventario/productos/${product.id}/receta`}>
                  Receta
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/inventario/productos?editar=${product.id}`}>Editar</Link>
            </Button>
            <ArchiveProductAction id={product.id} active={product.active} />
          </div>
        ) : (
          !product.active && (
            <span className="block text-right text-xs text-muted-foreground">Archivado</span>
          )
        )}
      </td>
    </tr>
  );
}
