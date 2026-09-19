import Link from "next/link";
import { PackageOpen, ScanLine } from "lucide-react";

import type { Role } from "@/lib/tenant/active-tenant";

export function QuickActions({ role }: { role: Role }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Link
        href="/ventas/pos"
        className="flex h-16 items-center gap-3 rounded-lg bg-primary px-4 text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
      >
        <ScanLine className="size-5" aria-hidden />
        <span className="text-sm font-medium">Vender</span>
      </Link>
      {role !== "member" && (
        <Link
          href="/inventario/productos"
          className="flex h-16 items-center gap-3 rounded-lg border border-border bg-card px-4 shadow-xs transition-colors hover:bg-muted"
        >
          <PackageOpen className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-medium">Agregar al inventario</span>
        </Link>
      )}
    </div>
  );
}
