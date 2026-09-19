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
