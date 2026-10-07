import { describe, expect, it } from "vitest";

import { loadMyOrders, rememberOrder } from "./my-orders";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("Mis pedidos en el navegador (S27-04)", () => {
  it("guarda el más reciente primero, sin duplicar, por tienda", () => {
    const s = memory();
    rememberOrder(s, "dulce", { code: "A", token: "t1", at: "2026-10-01" });
    rememberOrder(s, "dulce", { code: "B", token: "t2", at: "2026-10-02" });
    rememberOrder(s, "dulce", { code: "A", token: "t1", at: "2026-10-01" });
    expect(loadMyOrders(s, "dulce").map((o) => o.code)).toEqual(["A", "B"]);
    expect(loadMyOrders(s, "otra")).toEqual([]);
  });

  it("tope de 10", () => {
    const s = memory();
    for (let i = 0; i < 12; i++) rememberOrder(s, "dulce", { code: `C${i}`, token: `t${i}`, at: "x" });
    const list = loadMyOrders(s, "dulce");
    expect(list).toHaveLength(10);
    expect(list[0].code).toBe("C11");
  });

  it("almacenamiento roto o basura → lista vacía sin fallar", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(loadMyOrders(broken, "dulce")).toEqual([]);
    expect(() => rememberOrder(broken, "dulce", { code: "A", token: "t", at: "x" })).not.toThrow();
    const s = memory();
    s.m.set("tienda-pedidos:dulce", '[{"code": 1}, "x", {"code": "OK", "token": "t", "at": "y"}]');
    expect(loadMyOrders(s, "dulce")).toEqual([{ code: "OK", token: "t", at: "y" }]);
  });
});
