import Link from "next/link";
import { redirect } from "next/navigation";

import { getActiveTenant } from "@/lib/tenant/server";

import { PinForm } from "./pin-form";

export const metadata = { title: "Entrar como trabajador · Miel" };

/** S21-03 (ADR-037): pantalla del equipo de la tienda — cada trabajador entra con su código. */
export default async function TrabajadorPage() {
  const { active } = await getActiveTenant();
  if (!active) redirect("/onboarding");
  if (!active.storeMode) redirect("/inicio");

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{active.tenantName}</h1>
          <p className="text-sm text-muted-foreground">Escribe tu usuario y tu código para empezar.</p>
        </div>
        <PinForm />
        <Link href="/trabajador/salir" className="text-center text-xs text-muted-foreground underline underline-offset-4">
          Salir del modo tienda (encargado)
        </Link>
      </div>
    </main>
  );
}
