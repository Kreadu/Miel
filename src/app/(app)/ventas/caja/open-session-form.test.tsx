import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderIntl } from "@/i18n/test-utils";

import { OpenSessionForm } from "./open-session-form";

afterEach(cleanup);

describe("OpenSessionForm", () => {
  it("muestra el label y una ayuda en lenguaje llano bajo el monto base", () => {
    renderIntl(<OpenSessionForm />);
    const label = screen.getByText("Monto base de caja");
    expect(label).toBeTruthy();
    screen.getByText(/dinero con el que arrancas el turno/i);
  });
});
