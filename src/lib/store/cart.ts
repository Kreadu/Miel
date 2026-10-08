import { round2 } from "@/lib/money";
import { saleLine } from "@/lib/sales/line";

/** S27-02: carrito de la tienda — id de producto → unidades (1 a 99). */
export type Cart = Record<string, number>;
export const MAX_QTY = 99;

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Priced = { product_id: string; price: number; discount_percent: number; tax_rate: number };

const key = (slug: string) => `tienda-carrito:${slug}`;

export function setCartQty(cart: Cart, productId: string, qty: number): Cart {
  const next = { ...cart };
  const n = Math.min(MAX_QTY, Math.floor(qty));
  if (n >= 1) next[productId] = n;
  else delete next[productId];
  return next;
}

export function addToCart(cart: Cart, productId: string): Cart {
  return setCartQty(cart, productId, (cart[productId] ?? 0) + 1);
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

/** Total estimado (el real lo calcula la BD al hacer el pedido). */
/**
 * S27-02/S27-10: subtotal (sin IVA, con descuento), IVA y total del carrito — la misma cuenta por
 * línea que place_store_order (saleLine), así el total coincide con el del pedido.
 */
export function cartTotals(cart: Cart, products: Priced[]): { subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  let tax = 0;
  for (const p of products) {
    const qty = cart[p.product_id] ?? 0;
    if (!qty) continue;
    const line = saleLine(qty, Number(p.price), Number(p.discount_percent), Number(p.tax_rate));
    subtotal += line.net;
    tax += line.tax;
  }
  return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) };
}

/** Lee el carrito guardado; ante cualquier problema (bloqueado, corrupto) empieza vacío. */
export function loadCart(storage: Storage, slug: string): Cart {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key(slug)) ?? "{}");
    if (!raw || typeof raw !== "object") return {};
    return Object.entries(raw).reduce<Cart>(
      (cart, [id, qty]) => (typeof qty === "number" ? setCartQty(cart, id, qty) : cart),
      {},
    );
  } catch {
    return {};
  }
}

export function saveCart(storage: Storage, slug: string, cart: Cart): void {
  try {
    storage.setItem(key(slug), JSON.stringify(cart));
  } catch {
    // Navegador sin almacenamiento: el carrito vive mientras la página esté abierta.
  }
}
