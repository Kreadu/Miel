import { redirect } from "next/navigation";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";

import { AcceptForm } from "./accept-form";

export const metadata = { title: "Invitación · Miel" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Invitado sin sesión = usuario nuevo por definición: a signup, no a login (spec S1-05).
  // `next` reusa safeNext (S1-02) sin cambios — ya solo acepta rutas relativas internas.
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/invite/${token}`)}`);

  // El token es dato no confiable; si no tiene forma de uuid ni la RPC lo procesa. Evita
  // enviar basura obvia a la Server Action.
  const isValidToken = z.uuid().safeParse(token).success;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="flex items-center gap-2">
        <Logo className="h-8 w-auto" />
        <span className="text-2xl font-semibold tracking-tight text-primary">Miel</span>
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Invitación a un equipo</CardTitle>
            <CardDescription>
              Acepta para unirte a la empresa que te invitó.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isValidToken ? (
              <AcceptForm token={token} />
            ) : (
              <p role="alert" className="text-sm text-destructive">
                Esta invitación no es válida o ya fue usada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
