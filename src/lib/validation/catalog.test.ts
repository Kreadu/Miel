import { describe, expect, it } from "vitest";

import { categorySchema } from "./catalog";

describe("categorySchema", () => {
  it("acepta un nombre válido", () => {
    expect(categorySchema.safeParse({ name: "Endulzantes" }).success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rechaza nombre de solo espacios", () => {
    expect(categorySchema.safeParse({ name: "   " }).success).toBe(false);
  });
});
