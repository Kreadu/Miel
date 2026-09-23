import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Factory,
  Home,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import type { Role } from "./active-tenant";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Módulos que la matriz de permisos-roles.md reserva a owner/admin (docs/arch/permisos-roles.md). */
  ownerAdminOnly?: boolean;
  /** Dibuja un divisor visual antes de este ítem (operación diaria vs gestión). */
  separatorBefore?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/ventas", label: "Vender", icon: Receipt },
  { href: "/compras", label: "Comprar", icon: ShoppingCart },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/gastos", label: "Gastos", icon: Wallet, ownerAdminOnly: true },
  { href: "/produccion", label: "Producción", icon: Factory, separatorBefore: true },
  { href: "/finanzas", label: "Finanzas", icon: TrendingUp, ownerAdminOnly: true },
  { href: "/equipo", label: "Equipo", icon: Users, ownerAdminOnly: true },
];

/**
 * Módulos ocultos del menú y de Inicio para todos los roles (S14-01): el dueño de PYME no los usa
 * hoy. No es una baja de producto — revertir vaciando este Set. Rutas y código intactos.
 */
const HIDDEN_HREFS = new Set(["/produccion", "/finanzas"]);

/** UX, no frontera de seguridad: la frontera real es RLS (docs/arch/permisos-roles.md). */
export function visibleNavItems(role: Role): NavItem[] {
  const enabled = NAV_ITEMS.filter((item) => !HIDDEN_HREFS.has(item.href));
  if (role === "member") return enabled.filter((item) => !item.ownerAdminOnly);
  return enabled;
}
