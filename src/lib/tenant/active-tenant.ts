export type Role = "owner" | "admin" | "member";

export type ActiveMembership = {
  tenantId: string;
  role: Role;
  tenantName: string;
};

/**
 * Única regla de resolución del tenant activo (docs/arch/multitenancy-rls.md, regla 3):
 * el cliente nunca decide el tenant. La cookie es una preferencia, no una autorización —
 * solo se honra si corresponde a un membership real del usuario; si no, se cae al primero.
 */
export function resolveActiveTenant(
  memberships: ActiveMembership[],
  cookieTenantId: string | undefined,
): ActiveMembership | null {
  if (memberships.length === 0) return null;
  const match = memberships.find((m) => m.tenantId === cookieTenantId);
  return match ?? memberships[0];
}
