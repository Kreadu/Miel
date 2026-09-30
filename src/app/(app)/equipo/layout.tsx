import { requireModule } from "@/lib/tenant/server";

/** S21-03: solo quien tiene el módulo "rrhh" en su categoría (o sin restricción) entra aquí. */
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireModule("rrhh");
  return children;
}
