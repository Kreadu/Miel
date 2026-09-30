import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.forgot");
  return { title: `${t("title")} · Miel` };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("auth.forgot");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error === "link-invalido" ? (
          <p role="alert" className="text-sm text-destructive">
            {t("linkInvalid")}
          </p>
        ) : null}
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
