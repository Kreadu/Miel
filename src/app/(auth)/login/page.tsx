import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: `${t("title")} · Miel` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("auth.login");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm next={next} />
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            {t("forgot")}
          </Link>
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            {t("createAccount")}
          </Link>
        </div>
        {/* S21-03: los trabajadores no entran aquí, sino en el equipo de la tienda. */}
        <p className="text-xs text-muted-foreground">
          {t("workerHint")}
        </p>
      </CardContent>
    </Card>
  );
}
