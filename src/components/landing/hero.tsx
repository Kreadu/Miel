import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { DashboardMockup } from "./dashboard-mockup";
import { HexPattern } from "./hex-pattern";

export async function Hero() {
  const t = await getTranslations("landing.hero");
  return (
    <section className="relative flex flex-col items-center gap-10 px-6 pt-16 pb-20 sm:pt-24">
      <HexPattern id="hex-hero" />
      <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          {t("badge")}
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-muted-foreground text-balance sm:text-lg">
          {t("subtitle")}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button size="lg" asChild>
            <Link href="/signup">{t("cta")}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="!text-foreground no-underline"
          >
            <a href="#como-funciona">{t("how")}</a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("note")}
        </p>
      </div>
      <DashboardMockup />
    </section>
  );
}
