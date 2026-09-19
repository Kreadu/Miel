import { redirect } from "next/navigation";
import { Menu } from "lucide-react";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

import { SidebarNav } from "./sidebar-nav";
import { TenantSwitcher } from "./tenant-switcher";
import { BrandLink } from "./brand-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El anónimo ya lo corta el proxy; esto cubre membership perdida en caliente (caso borde).
  const { active, memberships } = await getActiveTenant();
  if (!active) redirect("/onboarding");

  const sidebarContent = (
    <>
      <div className="flex flex-col gap-1">
        <BrandLink />
        <p className="truncate text-sm font-medium">{active.tenantName}</p>
        <p className="text-xs text-muted-foreground capitalize">{active.role}</p>
      </div>
      <TenantSwitcher memberships={memberships} activeTenantId={active.tenantId} />
      <SidebarNav role={active.role} />
      <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
        </div>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit" className="w-full">
            Cerrar sesión
          </Button>
        </form>
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
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[280px] flex-col gap-4 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:flex">
        {sidebarContent}
      </aside>

      <main className="flex flex-1 flex-col min-w-0 p-4 md:p-6">{children}</main>
    </div>
  );
}
