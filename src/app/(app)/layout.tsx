import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Menu, ShoppingBag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/i18n/locales";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

import { BackButton } from "./back-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SidebarNav } from "./sidebar-nav";
import { StoreModeControls } from "./store-mode-controls";
import { TenantSwitcher } from "./tenant-switcher";
import { BrandLink } from "./brand-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("layout");

  // El anónimo ya lo corta el proxy; esto cubre membership perdida en caliente (caso borde).
  const { active, memberships } = await getActiveTenant();
  if (!active) redirect("/onboarding");
  // S21-03: en el equipo de la tienda, nadie usa Miel sin identificarse con su código.
  if (active.needsWorker) redirect("/trabajador");

  // S19-40: aviso de agotados o bajo el mínimo, para quien compra (dueño/admin o módulo Comprar).
  const seesPurchases = active.modules === null || active.modules.includes("compras");
  const { count: stockAlerts } = seesPurchases
    ? await supabase
        .from("low_stock_alerts")
        .select("product_id", { count: "exact", head: true })
        .eq("tenant_id", active.tenantId)
    : { count: 0 };

  // S27-04: pedidos nuevos de la tienda en línea (en borrador), para quien ve Vender.
  const seesSales = active.modules === null || active.modules.includes("ventas");
  const { count: newStoreOrders } = seesSales
    ? await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", active.tenantId)
        .eq("source", "store")
        .eq("status", "draft")
    : { count: 0 };

  // S26-05: logo de la empresa en lugar del de Miel (si lo subió en "Mi empresa").
  const { data: company } = await supabase.from("tenants").select("logo_url").eq("id", active.tenantId).maybeSingle();

  // S26-08: nombre de RRHH copiado en la membresía (o el correo si no está en Trabajadores).
  const { data: me } = active.storeMode
    ? { data: null }
    : await supabase
        .from("memberships")
        .select("display_name")
        .eq("tenant_id", active.tenantId)
        .eq("user_id", user?.id ?? "")
        .maybeSingle();

  const sidebarContent = (
    <>
      <div className="flex flex-col gap-1">
        <BrandLink logoUrl={company?.logo_url} companyName={active.tenantName} />
        <p className="truncate text-sm font-medium">{active.tenantName}</p>
        <p className="text-xs text-muted-foreground">{t(`roles.${active.role}`)}</p>
      </div>
      {/* Cuenta arriba (antes al fondo del menú, fuera de la vista en páginas largas). */}
      <div className="flex flex-col gap-2 rounded-lg border border-sidebar-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {active.storeMode ? null : me?.display_name ? (
              <p className="truncate text-sm font-medium">{me.display_name}</p>
            ) : null}
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>
        {active.storeMode ? null : (
          <div className="flex gap-2">
            {active.role !== "member" ? (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="/empresa">{t("myCompany")}</Link>
              </Button>
            ) : null}
            {/* En modo tienda no se cierra la sesión de la cuenta de tienda desde aquí. */}
            <form action={logout} className="flex-1">
              <Button variant="outline" size="sm" type="submit" className="w-full">
                {t("logout")}
              </Button>
            </form>
          </div>
        )}
      </div>
      {active.storeMode ? null : (
        <TenantSwitcher memberships={memberships} activeTenantId={active.tenantId} />
      )}
      <SidebarNav role={active.role} modules={active.modules} />
      <StoreModeControls
        storeMode={active.storeMode}
        workerName={active.worker?.name ?? null}
        canActivate={active.accountRole === "member"}
      />
    </>
  );

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <BrandLink logoUrl={company?.logo_url} companyName={active.tenantName} />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="size-5" />
              <span className="sr-only">{t("openMenu")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[280px] flex-col gap-4 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
            <SheetTitle className="sr-only">{t("menuTitle")}</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:flex">
        {sidebarContent}
      </aside>

      <main className="flex flex-1 flex-col min-w-0 p-4 md:p-6">
        <div className="mb-2 flex items-center justify-between">
          <BackButton />
          {/* ml-auto en vez de depender de justify-between: BackButton devuelve null en
              /inicio, y con un solo hijo real justify-between no lo empuja a la derecha. */}
          <LanguageSwitcher currentLocale={locale} />
        </div>
        {newStoreOrders ? (
          <Link
            href="/ventas/pedidos"
            className="mb-4 flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/15"
          >
            <ShoppingBag className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{t("storeOrders", { count: newStoreOrders })}</span>
            <span className="underline underline-offset-4">{t("storeOrdersAction")}</span>
          </Link>
        ) : null}
        {stockAlerts ? (
          <Link
            href="/inventario/alertas"
            className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/15"
          >
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{t("stockAlert", { count: stockAlerts })}</span>
            <span className="underline underline-offset-4">{t("stockAlertAction")}</span>
          </Link>
        ) : null}
        {children}
      </main>
    </div>
  );
}
