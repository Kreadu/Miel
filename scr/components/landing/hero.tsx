import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardMockup } from "./dashboard-mockup";
import { HexPattern } from "./hex-pattern";

export function Hero() {
  return (
    <section className="relative flex flex-col items-center gap-10 px-6 pt-16 pb-20 sm:pt-24">
      <HexPattern id="hex-hero" />
      <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          Comienza gratis
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Tus finanzas, dulces como la miel
        </h1>
        <p className="max-w-xl text-muted-foreground text-balance sm:text-lg">
          Compras, inventario, ventas y pagos en un solo lugar. El ERP simple
          para pymes que no tienen tiempo de pelear con su software.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button size="lg" asChild>
            <Link href="/signup">Crear cuenta gratis</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="!text-foreground no-underline"
          >
            <a href="#como-funciona">Ver cómo funciona</a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sin tarjeta de crédito · Configura tu empresa en minutos
        </p>
      </div>
      <DashboardMockup />
    </section>
  );
}
