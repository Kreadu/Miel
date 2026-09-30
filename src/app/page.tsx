import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Beneficios } from "@/components/landing/beneficios";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { CtaFinal } from "@/components/landing/cta-final";
import { Hero } from "@/components/landing/hero";
import { ScrollFx } from "@/components/landing/scroll-fx";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("ogTitle"), description: t("ogDescription"), type: "website", locale: await getLocale() },
    twitter: { card: "summary_large_image" },
  };
}

export default function Home() {
  return (
    // overflow-x-clip: el rotateX del mockup puede ensanchar el bounding box (gate 375px).
    <div className="flex flex-1 flex-col overflow-x-clip">
      <ScrollFx />
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Beneficios />
        <ComoFunciona />
        <CtaFinal />
      </main>
      <SiteFooter />
    </div>
  );
}
