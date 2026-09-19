import { cookies } from "next/headers";

export const ACTIVE_TENANT_COOKIE = "active_tenant";

/** Config compartida por toda escritura de la cookie `active_tenant` (S1-04, S1-05). */
export async function writeActiveTenantCookie(tenantId: string): Promise<void> {
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
