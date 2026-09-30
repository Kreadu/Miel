import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: `${t("title")} · Miel` };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
