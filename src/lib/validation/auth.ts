import { z } from "zod";

// E20: los mensajes son claves de messages/*.json (auth.errors.*); el formulario los traduce.

const email = z.email({ error: "auth.errors.emailInvalid" });
const password = z
  .string()
  .min(8, { error: "auth.errors.passwordMin" });

export const signupSchema = z.object({ email, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "auth.errors.passwordRequired" }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password });
