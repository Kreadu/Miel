import { redirect } from "next/navigation";
import { Menu } from "lucide-react";
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

  const sidebarContent = (
    <>
      <div className="flex flex-col gap-1">
        <BrandLink />
        <p className="truncate text-sm font-medium">{active.tenantName}</p>
        <p className="text-xs text-muted-foreground">{t(`roles.${active.role}`)}</p>
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
      <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
        </div>
        {/* En modo tienda no se cierra la sesión de la cuenta de tienda desde aquí. */}
        {active.storeMode ? null : (
          <form action={logout}>
            <Button variant="outline" size="sm" type="submit" className="w-full">
              {t("logout")}
            </Button>
          </form>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <BrandLink />
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
        {children}
      </main>
    </div>
  );
}
