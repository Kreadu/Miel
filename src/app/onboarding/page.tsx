import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";

import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: `${t("title")} · Miel` };
}

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS de memberships es visible a todo el equipo del tenant (S1-05), por eso el filtro
  // por user_id es explícito — mismo caso que getActiveTenant (src/lib/tenant/server.ts).
  const { data: myMemberships } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id);
  const memberships = myMemberships ?? [];

  const t = await getTranslations("onboarding");

  // La empresa se funda solo en el registro inicial (ADR-031): con cualquier membership previa
  // (propia u obtenida por invitación) ya no hay nada que crear aquí.
  if (memberships.length > 0) redirect("/inicio");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="flex items-center gap-2">
        <Logo className="h-8 w-auto" />
        <span className="text-2xl font-semibold tracking-tight text-primary">Miel</span>
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <OnboardingForm />
            <div className="flex justify-end text-sm">
              <form action={logout}>
                <Button variant="outline" type="submit">
                  {t("logout")}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
