import Link from "next/link";
import { redirect } from "next/navigation";

import { getActiveTenant } from "@/lib/tenant/server";

import { ExitForm } from "./exit-form";

export const metadata = { title: "Salir del modo tienda · Miel" };

export default async function SalirModoTiendaPage() {
  const { active } = await getActiveTenant();
  if (!active) redirect("/onboarding");
  if (!active.storeMode) redirect("/inicio");

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Salir del modo tienda</h1>
          <p className="text-sm text-muted-foreground">
            Solo el encargado: al salir, este equipo deja de pedir el código a los trabajadores.
          </p>
        </div>
        <ExitForm />
        <Link href="/trabajador" className="text-center text-xs text-muted-foreground underline underline-offset-4">
          Volver
        </Link>
      </div>
    </main>
  );
}
