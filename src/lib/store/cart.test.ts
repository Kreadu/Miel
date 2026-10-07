import { describe, expect, it } from "vitest";

import { addToCart, cartCount, cartTotal, loadCart, MAX_QTY, saveCart, setCartQty } from "./cart";

describe("carrito (S27-02)", () => {
  it("agrega, suma y respeta el tope de 99", () => {
    let cart = addToCart({}, "p1");
    cart = addToCart(cart, "p1");
    expect(cart).toEqual({ p1: 2 });
    expect(setCartQty(cart, "p1", 500)).toEqual({ p1: MAX_QTY });
    expect(addToCart({ p1: MAX_QTY }, "p1")).toEqual({ p1: MAX_QTY });
  });

  it("cantidad 0 o inválida quita el producto", () => {
    expect(setCartQty({ p1: 2, p2: 1 }, "p1", 0)).toEqual({ p2: 1 });
    expect(setCartQty({ p1: 2 }, "p1", Number.NaN)).toEqual({});
  });

  it("cuenta unidades y estima el total con descuento e IVA", () => {
    const cart = { p1: 2, p2: 1, gone: 3 };
    const products = [
      { product_id: "p1", price: 10000, discount_percent: 10, tax_rate: 19 },
      { product_id: "p2", price: 5000, discount_percent: 0, tax_rate: 0 },
    ];
    expect(cartCount(cart)).toBe(6);
    // 2 × 10710 + 5000 (el producto que ya no está en el catálogo no suma)
    expect(cartTotal(cart, products)).toBe(26420);
  });

  it("guarda y lee por tienda; con almacenamiento roto devuelve vacío sin fallar", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    saveCart(storage, "dulce", { p1: 2 });
    expect(loadCart(storage, "dulce")).toEqual({ p1: 2 });
    expect(loadCart(storage, "otra")).toEqual({});

    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadCart(broken, "dulce")).toEqual({});
    expect(() => saveCart(broken, "dulce", { p1: 1 })).not.toThrow();
    mem.set("tienda-carrito:dulce", "{basura");
    expect(loadCart(storage, "dulce")).toEqual({});
    mem.set("tienda-carrito:dulce", '{"p1": 1000, "p2": "x", "p3": 2}');
    expect(loadCart(storage, "dulce")).toEqual({ p1: MAX_QTY, p3: 2 });
  });
});
