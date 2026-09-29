"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  discountPercent: number;
  taxRate: number;
  qty: number;
};

function storageKey(tenantId: string): string {
  return `miel:catalogo-pedido:${tenantId}`;
}

function parse(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

const EMPTY_CART: CartLine[] = [];

// useSyncExternalStore exige que getSnapshot devuelva la MISMA referencia si el store no
// cambió — localStorage.getItem + JSON.parse en cada llamada crea un array nuevo siempre,
// lo que React interpreta como "cambió" en cada render y entra en loop infinito (bug real
// encontrado por el humano). Este caché por tenant evita reparsear si el string crudo es igual.
const snapshotCache = new Map<string, { raw: string | null; lines: CartLine[] }>();

function getSnapshot(tenantId: string): CartLine[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(tenantId));
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(tenantId);
  if (cached && cached.raw === raw) return cached.lines;

  const lines = raw ? parse(raw) : EMPTY_CART;
  snapshotCache.set(tenantId, { raw, lines });
  return lines;
}

const listeners = new Set<() => void>();

function writeCart(tenantId: string, lines: CartLine[]): void {
  const raw = JSON.stringify(lines);
  try {
    localStorage.setItem(storageKey(tenantId), raw);
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — el carrito queda solo en memoria
    // de esta carga de página, sin romper la interacción.
  }
  // Actualiza el caché con la misma referencia `lines` que ya tenemos, para no reparsear el
  // string que acabamos de escribir en la próxima lectura.
  snapshotCache.set(tenantId, { raw, lines });
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Carrito del catálogo (S19-06): scratch state en `localStorage`, por tenant — no es
 * persistencia de servidor, se descarta al confirmar el pedido (`createSale`) o si se borra el
 * sitio. `useSyncExternalStore` (no un `useEffect` con `setState`) porque localStorage es un
 * store externo síncrono: server-side siempre ve el carrito vacío (`getServerSnapshot`), y el
 * cliente se sincroniza al montar sin el patrón "cascading render" que el lint de efectos marca.
 */
export function useCatalogCart(tenantId: string) {
  const lines = useSyncExternalStore(
    subscribe,
    () => getSnapshot(tenantId),
    () => EMPTY_CART,
  );

  const addItem = useCallback(
    (product: Omit<CartLine, "qty">, qty = 1) => {
      const current = getSnapshot(tenantId);
      const existing = current.find((l) => l.productId === product.productId);
      const next = existing
        ? current.map((l) =>
            l.productId === product.productId ? { ...l, qty: l.qty + qty } : l,
          )
        : [...current, { ...product, qty }];
      writeCart(tenantId, next);
    },
    [tenantId],
  );

  const updateQty = useCallback(
    (productId: string, qty: number) => {
      const current = getSnapshot(tenantId);
      const next =
        qty <= 0
          ? current.filter((l) => l.productId !== productId)
          : current.map((l) => (l.productId === productId ? { ...l, qty } : l));
      writeCart(tenantId, next);
    },
    [tenantId],
  );

  // S19-11: reconcilia precio/descuento/IVA de una línea contra datos frescos del servidor
  // (la cantidad elegida por el humano no se toca). El carrito guarda una foto de esos datos al
  // agregar el producto — sin esto, un cambio de precio/IVA después de agregarlo queda
  // desactualizado en el carrito hasta que se vacía y se vuelve a agregar.
  const updateLineData = useCallback(
    (productId: string, data: Omit<CartLine, "productId" | "qty">) => {
      const current = getSnapshot(tenantId);
      const next = current.map((l) => (l.productId === productId ? { ...l, ...data } : l));
      writeCart(tenantId, next);
    },
    [tenantId],
  );

  const removeItem = useCallback(
    (productId: string) => {
      writeCart(
        tenantId,
        getSnapshot(tenantId).filter((l) => l.productId !== productId),
      );
    },
    [tenantId],
  );

  const clear = useCallback(() => {
    writeCart(tenantId, EMPTY_CART);
  }, [tenantId]);

  return { lines, addItem, updateQty, updateLineData, removeItem, clear };
}
