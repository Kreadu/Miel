/** S27-04: los últimos pedidos del cliente en esta tienda, guardados solo en su navegador. */
export type MyOrder = { code: string; token: string; at: string };
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const MAX = 10;
const key = (slug: string) => `tienda-pedidos:${slug}`;

export function loadMyOrders(storage: Storage, slug: string): MyOrder[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key(slug)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (o): o is MyOrder =>
        !!o && typeof o.code === "string" && typeof o.token === "string" && typeof o.at === "string",
    );
  } catch {
    return [];
  }
}

export function rememberOrder(storage: Storage, slug: string, order: MyOrder): void {
  try {
    const rest = loadMyOrders(storage, slug).filter((o) => o.token !== order.token);
    storage.setItem(key(slug), JSON.stringify([order, ...rest].slice(0, MAX)));
  } catch {
    // Sin almacenamiento: no hay "Mis pedidos", el resto funciona.
  }
}
