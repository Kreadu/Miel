import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SignupForm } from "./signup-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.signup");
  return { title: `${t("title")} · Miel` };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("auth.signup");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignupForm next={next} />
        <p className="text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t("loginLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
