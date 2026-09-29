import { describe, expect, it } from "vitest";

import { parentPath } from "./parent-path";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("parentPath (S19-33: Volver sube a la sección de arriba)", () => {
  it.each([
    ["/ventas", "/inicio"],
    ["/inventario", "/inicio"],
    ["/ventas/catalogo", "/ventas"],
    ["/inventario/vehiculos", "/inventario"],
    ["/inventario/alertas", "/inventario"],
    ["/compras/ordenes", "/compras"],
    [`/inventario/productos/${ID}/receta`, "/inventario/productos"],
    [`/inventario/kardex/${ID}`, "/inventario"],
    [`/compras/proveedores/${ID}/cuenta`, "/compras/proveedores"],
    [`/ventas/clientes/${ID}`, "/ventas/clientes"],
  ])("%s → %s", (from, to) => {
    expect(parentPath(from)).toBe(to);
  });

  it("ignora la barra final", () => {
    expect(parentPath("/ventas/catalogo/")).toBe("/ventas");
  });
});
