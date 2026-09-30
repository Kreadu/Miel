import { requireModule } from "@/lib/tenant/server";

/** S21-03: solo quien tiene el módulo "compras" en su categoría (o sin restricción) entra aquí. */
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireModule("compras");
  return children;
}
