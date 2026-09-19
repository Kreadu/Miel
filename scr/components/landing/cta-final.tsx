import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HexPattern } from "./hex-pattern";

export function CtaFinal() {
  return (
    <section className="relative mx-auto w-full max-w-4xl px-6 py-16">
      <div
        className="relative flex flex-col items-center gap-4 overflow-hidden rounded-xl border bg-card px-6 py-12 text-center"
        data-reveal
      >
        <HexPattern id="hex-cta" className="opacity-70" />
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Empieza hoy, totalmente gratis
        </h2>
        <p className="max-w-md text-muted-foreground text-balance">
          Construye el futuro de tu negocio con el ERP simple que las pymes merecen.
        </p>
        <Button size="lg" asChild className="mt-2">
          <Link href="/signup">Crear cuenta gratis</Link>
        </Button>
      </div>
    </section>
  );
}
