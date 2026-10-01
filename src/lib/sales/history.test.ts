import { describe, expect, it } from "vitest";

import { salesHistoryTotals } from "./history";

describe("salesHistoryTotals (S18-11)", () => {
  it("suma vendido y cobrado sin las anuladas", () => {
    expect(
      salesHistoryTotals([
        { status: "delivered", total: 100, paid: 100 },
        { status: "confirmed", total: 50, paid: 20 },
        { status: "cancelled", total: 70, paid: 0 },
      ]),
    ).toEqual({ sold: 150, collected: 120 });
  });
});
