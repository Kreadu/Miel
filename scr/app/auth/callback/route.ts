import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation/safe-redirect";

/** Intercambia el código del enlace de recuperación por una sesión (criterio 4 de S1-02). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), origin));
    }
    console.error("auth/callback:", error.code);
  }

  // Código ausente, inválido o ya consumido → mensaje claro y opción de reenviar.
  return NextResponse.redirect(new URL("/forgot-password?error=link-invalido", origin));
}
