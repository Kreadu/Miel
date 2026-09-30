import { describe, expect, it } from "vitest";

import { defaultCategoryKey } from "./category-label";

describe("defaultCategoryKey (S20-05)", () => {
  it("reconoce las categorías que trae Miel por su nombre exacto", () => {
    expect(defaultCategoryKey("Arriendo")).toBe("rent");
    expect(defaultCategoryKey("Comisiones bancarias y datáfono")).toBe("bankFees");
  });

  it("las propias o renombradas quedan sin traducir", () => {
    expect(defaultCategoryKey("Arriendo bodega norte")).toBeNull();
    expect(defaultCategoryKey("arriendo")).toBeNull();
  });
});
