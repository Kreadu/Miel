import { describe, expect, it } from "vitest";

import { buildStoreOrderEmail } from "./store-order-email";

describe("buildStoreOrderEmail (S27-04)", () => {
  const params = { storeName: "Dulce <b>Miel</b>", code: "ABCD1234", total: "$26.420", ordersUrl: "https://app.x/ventas/pedidos" };

  it("asunto y cuerpo con el código, el total y el enlace a Pedidos", () => {
    const email = buildStoreOrderEmail(params);
    expect(email.subject).toBe("Pedido nuevo #ABCD1234 en tu tienda en línea");
    expect(email.html).toContain("#ABCD1234");
    expect(email.html).toContain("$26.420");
    expect(email.html).toContain('href="https://app.x/ventas/pedidos"');
  });

  it("escapa el nombre de la tienda (es dato, no HTML)", () => {
    expect(buildStoreOrderEmail(params).html).toContain("Dulce &lt;b&gt;Miel&lt;/b&gt;");
  });

  it("no lleva la llave secreta del cliente ni enlaces a la tienda pública", () => {
    expect(buildStoreOrderEmail(params).html).not.toMatch(/\/tienda\//);
  });
});
