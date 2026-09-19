"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { safeNext } from "@/lib/validation/safe-redirect";

/** Estado para useActionState: null = sin submit todavía. */
export type AuthState =
  | { ok: false; error: string; email?: string }
  | { ok: true; message: string }
  | null;

/** Correo tal cual lo envió el usuario, para repoblar el formulario si falla (nunca la contraseña). */
function rawEmail(formData: FormData): string | undefined {
  const value = formData.get("email");
  return typeof value === "string" ? value : undefined;
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, email: rawEmail(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    console.error("signup:", error.code);
    return {
      ok: false,
      error: "No se pudo completar el registro. Intenta de nuevo.",
      email: rawEmail(formData),
    };
  }

  redirect(safeNext(formData.get("next")));
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, email: rawEmail(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Genérico a propósito: sin enumeración de usuarios (criterio 2).
    return { ok: false, error: "Correo o contraseña incorrectos.", email: rawEmail(formData) };
  }

  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, email: rawEmail(formData) };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) {
    console.error("requestPasswordReset:", error.code);
    return {
      ok: false,
      error: "No se pudo enviar el correo. Intenta de nuevo en unos minutos.",
      email: rawEmail(formData),
    };
  }

  // Mismo mensaje exista o no la cuenta: sin enumeración de usuarios.
  return { ok: true, message: "Si el correo existe, enviamos un enlace de recuperación." };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("updatePassword:", error.code);
    return {
      ok: false,
      error: "No se pudo actualizar la contraseña. El enlace pudo expirar — solicita uno nuevo.",
    };
  }

  redirect(safeNext(formData.get("next")));
}
