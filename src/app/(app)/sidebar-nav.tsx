"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { visibleNavItems } from "@/lib/tenant/nav-visibility";
import type { Role } from "@/lib/tenant/active-tenant";

// Los ítems (con sus componentes de ícono) se calculan aquí, en el cliente: un componente
// de ícono no es serializable como prop desde un Server Component (RSC boundary).
export function SidebarNav({ role, modules }: { role: Role; modules: string[] | null }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = visibleNavItems(role, modules);

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, i18nKey, icon: Icon, separatorBefore }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Fragment key={href}>
            {separatorBefore && <div className="my-2 h-px bg-sidebar-border" aria-hidden />}
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(i18nKey)}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
