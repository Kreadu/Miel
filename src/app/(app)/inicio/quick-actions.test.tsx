import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { QuickActions } from "./quick-actions";

afterEach(cleanup);

describe("QuickActions", () => {
  it("owner ve Vender y Agregar al inventario con sus destinos", () => {
    render(<QuickActions role="owner" />);
    const vender = screen.getByRole("link", { name: /vender/i });
    expect(vender.getAttribute("href")).toBe("/ventas/pos");
    const inventario = screen.getByRole("link", { name: /agregar al inventario/i });
    expect(inventario.getAttribute("href")).toBe("/inventario/productos");
  });

  it("admin ve ambos accesos", () => {
    render(<QuickActions role="admin" />);
    screen.getByRole("link", { name: /vender/i });
    screen.getByRole("link", { name: /agregar al inventario/i });
  });

  it("member ve Vender pero no Agregar al inventario", () => {
    render(<QuickActions role="member" />);
    screen.getByRole("link", { name: /vender/i });
    expect(screen.queryByRole("link", { name: /agregar al inventario/i })).toBeNull();
  });
});
