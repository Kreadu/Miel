import { z } from "zod";

const email = z.email({ error: "Correo electrónico inválido" });
const password = z
  .string()
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres" });

export const signupSchema = z.object({ email, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Ingresa tu contraseña" }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password });
