import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PasswordInput } from "./password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("renderiza type=password por defecto", () => {
    render(<PasswordInput name="password" />);
    screen.getByLabelText(/mostrar contraseña/i);
    const input = document.querySelector("input[name='password']") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("password");
  });

  it("alterna type entre password y text al hacer click", () => {
    render(<PasswordInput name="password" />);
    const input = document.querySelector("input[name='password']") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: /mostrar contraseña/i });

    fireEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: /ocultar contraseña/i }));
    expect(input.getAttribute("type")).toBe("password");
  });

  it("refleja aria-pressed y aria-label según el estado", () => {
    render(<PasswordInput name="password" />);
    const toggle = screen.getByRole("button", { name: /mostrar contraseña/i });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /ocultar contraseña/i }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("el botón toggle es type=button (no envía el formulario)", () => {
    render(<PasswordInput name="password" />);
    const toggle = screen.getByRole("button", { name: /mostrar contraseña/i });
    expect(toggle.getAttribute("type")).toBe("button");
  });

  it("reenvía props (name, autoComplete, minLength, required) al input interno", () => {
    render(
      <PasswordInput
        id="password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
    );
    const input = document.querySelector("input[name='password']") as HTMLInputElement;
    expect(input.id).toBe("password");
    expect(input.autocomplete).toBe("new-password");
    expect(input.minLength).toBe(8);
    expect(input.required).toBe(true);
  });
});
