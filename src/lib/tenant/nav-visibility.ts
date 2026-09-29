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
  /** E20 (piloto i18n): clave en messages/*.json → nav.<i18nKey>. `label` (español) sigue
   * usándose donde todavía no se tradujo (p. ej. la grilla de Módulos de /inicio). */
  i18nKey: string;
  icon: LucideIcon;
  /** Módulos que la matriz de permisos-roles.md reserva a owner/admin (docs/arch/permisos-roles.md). */
  ownerAdminOnly?: boolean;
  /** Dibuja un divisor visual antes de este ítem (operación diaria vs gestión). */
  separatorBefore?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio", i18nKey: "inicio", icon: Home },
  { href: "/ventas", label: "Vender", i18nKey: "vender", icon: Receipt },
  { href: "/compras", label: "Comprar", i18nKey: "comprar", icon: ShoppingCart },
  { href: "/inventario", label: "Inventario", i18nKey: "inventario", icon: Boxes },
  { href: "/gastos", label: "Gastos", i18nKey: "gastos", icon: Wallet, ownerAdminOnly: true },
  {
    href: "/produccion",
    label: "Producción",
    i18nKey: "produccion",
    icon: Factory,
    separatorBefore: true,
  },
  {
    href: "/finanzas",
    label: "Finanzas",
    i18nKey: "finanzas",
    icon: TrendingUp,
    ownerAdminOnly: true,
  },
  { href: "/equipo", label: "Equipo", i18nKey: "equipo", icon: Users, ownerAdminOnly: true },
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
