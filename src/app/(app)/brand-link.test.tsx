import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { BrandLink } from "./brand-link";

afterEach(cleanup);

describe("BrandLink", () => {
  it("es un link a /inicio con nombre accesible Miel", () => {
    render(<BrandLink />);
    const link = screen.getByRole("link", { name: "Miel" });
    expect(link.getAttribute("href")).toBe("/inicio");
  });
});

describe("BrandLink con logo de la empresa (S26-05)", () => {
  it("muestra el logo de la empresa en lugar del de Miel", () => {
    render(<BrandLink logoUrl="https://x/logo.png" companyName="Panadería Sol" />);
    const link = screen.getByRole("link", { name: "Panadería Sol" });
    expect(link.getAttribute("href")).toBe("/inicio");
    expect(screen.queryByText("Miel")).toBeNull();
  });
});
