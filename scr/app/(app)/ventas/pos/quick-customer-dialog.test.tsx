import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/actions/customers", () => ({
  createCustomer: vi.fn(async () => ({ ok: true, customer: { id: "c1", name: "Ana" } })),
}));

import { QuickCustomerDialog } from "./quick-customer-dialog";

afterEach(cleanup);

describe("QuickCustomerDialog", () => {
  it("el botón abre el modal con los 4 campos del alta rápida", () => {
    render(<QuickCustomerDialog onCreated={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /nuevo cliente/i }));

    screen.getByLabelText(/nombre/i);
    screen.getByLabelText(/tipo.*doc/i);
    screen.getByLabelText(/número.*doc/i);
    screen.getByLabelText(/teléfono/i);
  });
});
