import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { visibleNavItems } from "@/lib/tenant/nav-visibility";
import { getActiveTenant } from "@/lib/tenant/server";
import { DashboardMetricsCards } from "./dashboard-metrics-cards";
import { DashboardInsights } from "./dashboard-insights";
import { QuickActions } from "./quick-actions";

export const metadata = { title: "Inicio · Miel" };

export default async function InicioPage() {
  const { active } = await getActiveTenant();
  if (!active) redirect("/onboarding");
  
  const modules = visibleNavItems(active.role).filter((item) => item.href !== "/inicio");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hola de nuevo</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      <QuickActions role={active.role} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Módulos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {modules.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:bg-muted"
            >
              <Icon className="size-5 text-primary" aria-hidden />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {active?.role !== "member" && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium tracking-tight">Resumen gerencial</h2>
          <Suspense fallback={<div className="h-28 rounded-xl border bg-muted/50 animate-pulse" />}>
            <DashboardMetricsCards />
          </Suspense>
          <Suspense fallback={<div className="h-64 rounded-xl border bg-muted/50 animate-pulse" />}>
            <DashboardInsights />
          </Suspense>
        </section>
      )}
    </div>
  );
}
