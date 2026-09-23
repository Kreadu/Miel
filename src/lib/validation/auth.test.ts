import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "./auth";

const validCredentials = { email: "ana@empresa.co", password: "secreta123" };

describe("signupSchema", () => {
  it("acepta email y contraseña válidos", () => {
    expect(signupSchema.safeParse(validCredentials).success).toBe(true);
  });

  it("rechaza email malformado con mensaje en español", () => {
    const result = signupSchema.safeParse({ ...validCredentials, email: "no-es-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Correo electrónico inválido");
    }
  });

  it("rechaza contraseña de menos de 8 caracteres con mensaje en español", () => {
    const result = signupSchema.safeParse({ ...validCredentials, password: "corta12" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "La contraseña debe tener al menos 8 caracteres",
      );
    }
  });
});

describe("loginSchema", () => {
  it("acepta credenciales válidas", () => {
    expect(loginSchema.safeParse(validCredentials).success).toBe(true);
  });

  it("rechaza email malformado", () => {
    expect(loginSchema.safeParse({ ...validCredentials, email: "x@" }).success).toBe(false);
  });

  it("rechaza contraseña vacía", () => {
    expect(loginSchema.safeParse({ ...validCredentials, password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("acepta un email válido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "ana@empresa.co" }).success).toBe(true);
  });

  it("rechaza email malformado", () => {
    expect(forgotPasswordSchema.safeParse({ email: "sin-arroba" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("acepta una contraseña nueva válida", () => {
    expect(resetPasswordSchema.safeParse({ password: "nuevaClave9" }).success).toBe(true);
  });

  it("rechaza contraseña corta con mensaje en español", () => {
    const result = resetPasswordSchema.safeParse({ password: "corta" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "La contraseña debe tener al menos 8 caracteres",
      );
    }
  });
});
