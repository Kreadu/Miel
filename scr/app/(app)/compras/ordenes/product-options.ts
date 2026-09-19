// S15-01 — partición pura del catálogo para el selector de producto de la orden de compra:
// "sugeridos" (asociados al proveedor elegido) primero, resto del catálogo debajo si se pide.
// Extraído del componente para poder testearlo sin montar el Select de Radix (jsdom no soporta
// bien pointer events sobre popovers).
export type ProductOption = { id: string; name: string; sku: string };

export function splitProducts(
  products: ProductOption[],
  suggestedIds: string[],
  { showAll, keepIds }: { showAll: boolean; keepIds: string[] },
): { suggested: ProductOption[]; rest: ProductOption[] } {
  const suggestedSet = new Set(suggestedIds);
  const suggested = products.filter((p) => suggestedSet.has(p.id));

  // Sin sugerencias (proveedor sin asociar o sin elegir): la vista plana de siempre, todo en
  // "rest" y nada en "suggested" — nunca bloquea ni esconde nada del catálogo.
  if (suggested.length === 0) {
    return { suggested: [], rest: products };
  }

  if (!showAll) {
    // keepIds: productos ya elegidos en algún ítem del formulario. Deben seguir listados aunque
    // no sean sugeridos, o el Select de un ítem ya cargado (p. ej. al editar una orden) queda
    // con un value sin opción visible.
    const keepSet = new Set(keepIds);
    const extra = products.filter((p) => !suggestedSet.has(p.id) && keepSet.has(p.id));
    return { suggested: [...suggested, ...extra], rest: [] };
  }

  const rest = products.filter((p) => !suggestedSet.has(p.id));
  return { suggested, rest };
}
