import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { CloseSessionForm } from "./close-session-form";

afterEach(cleanup);

describe("CloseSessionForm", () => {
  it("muestra el label y una ayuda que explica la comparación contra lo esperado", () => {
    render(<CloseSessionForm sessionId="s1" />);
    const label = screen.getByText("Monto contado al cierre");
    expect(label).toBeTruthy();
    screen.getByText(/cuenta el efectivo/i);
    screen.getByText(/ventas en efectivo del turno/i);
  });
});
