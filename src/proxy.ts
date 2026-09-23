import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/validation/safe-redirect";

// /reset-password queda fuera: el enlace de recuperación deja al usuario autenticado
// y debe poder fijar su contraseña nueva (criterio 4 de S1-02).
const AUTH_ONLY_ANON_PATHS = ["/login", "/signup", "/forgot-password"];
// Público explícito (landing + rutas anónimas + callback de auth); todo lo demás requiere
// sesión — cubre (app), /onboarding y /reset-password sin enumerar cada módulo (S1-04).
// /invite/<token> también es público: un invitado sin cuenta debe poder abrirlo y la propia
// página decide el destino (signup, no login — S1-05); con sesión, la página llama la RPC.
const PUBLIC_PATHS = ["/", "/auth", "/invite", ...AUTH_ONLY_ANON_PATHS];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión y valida contra el servidor de Auth (nunca confiar solo en la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ONLY_ANON_PATHS.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AUTHENTICATED_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
