import type { Metadata } from "next";

import { Beneficios } from "@/components/landing/beneficios";
import { ComoFunciona } from "@/components/landing/como-funciona";
import { CtaFinal } from "@/components/landing/cta-final";
import { Hero } from "@/components/landing/hero";
import { ScrollFx } from "@/components/landing/scroll-fx";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  title: "Miel — ERP simple para pymes | Compras, inventario y ventas",
  description:
    "Compras, inventario, ventas y pagos en un solo lugar. Miel es el ERP simple para pymes. Comienza gratis.",
  openGraph: {
    title: "Miel — ERP simple para pymes",
    description:
      "Compras, inventario, ventas y pagos en un solo lugar. Comienza gratis.",
    type: "website",
    locale: "es",
  },
  twitter: {
    card: "summary_large_image",
  },
};

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
