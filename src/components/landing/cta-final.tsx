import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { HexPattern } from "./hex-pattern";

export async function CtaFinal() {
  const t = await getTranslations("landing.cta");
  return (
    <section className="relative mx-auto w-full max-w-4xl px-6 py-16">
      <div
        className="relative flex flex-col items-center gap-4 overflow-hidden rounded-xl border bg-card px-6 py-12 text-center"
        data-reveal
      >
        <HexPattern id="hex-cta" className="opacity-70" />
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t("title")}
        </h2>
        <p className="max-w-md text-muted-foreground text-balance">
          {t("subtitle")}
        </p>
        <Button size="lg" asChild className="mt-2">
          <Link href="/signup">{t("button")}</Link>
        </Button>
      </div>
    </section>
  );
}
