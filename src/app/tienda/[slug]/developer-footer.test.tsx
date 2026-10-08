import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DeveloperFooter } from "./developer-footer";

afterEach(cleanup);

describe("DeveloperFooter (S27-08)", () => {
  it("muestra los datos fijos de Kreadu con correo y WhatsApp", () => {
    render(<DeveloperFooter />);
    expect(screen.getByText("KREADU")).toBeTruthy();
    expect(screen.getByText("KREADU S.A.S. — NIT 901790185-0")).toBeTruthy();
    expect(screen.getByText("AI Business Systems Lab")).toBeTruthy();
    expect(screen.getByRole("link", { name: "is@kreadu.com" }).getAttribute("href")).toBe("mailto:is@kreadu.com");
    expect(screen.getByRole("link", { name: "Let's Talk" }).getAttribute("href")).toBe("mailto:is@kreadu.com");
    expect(screen.getByRole("link", { name: "(+57) 3235297951" }).getAttribute("href")).toBe("https://wa.me/573235297951");
    expect(screen.getByRole("link", { name: "(+57) 3225832662" }).getAttribute("href")).toBe("https://wa.me/573225832662");
  });

  it("es una franja de una línea: sin títulos de sección", () => {
    render(<DeveloperFooter />);
    expect(screen.queryByText("Company")).toBeNull();
    expect(screen.queryByText("Social")).toBeNull();
  });
});
