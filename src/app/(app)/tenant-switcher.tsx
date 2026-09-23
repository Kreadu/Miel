"use client";

import { setActiveTenant } from "@/actions/tenant";
import type { ActiveMembership } from "@/lib/tenant/active-tenant";

export function TenantSwitcher({
  memberships,
  activeTenantId,
}: {
  memberships: ActiveMembership[];
  activeTenantId: string;
}) {
  if (memberships.length <= 1) return null;

  return (
    <form action={setActiveTenant}>
      <label className="sr-only" htmlFor="tenantId">
        Empresa activa
      </label>
      <select
        id="tenantId"
        name="tenantId"
        defaultValue={activeTenantId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar px-2 text-sm text-sidebar-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {memberships.map((m) => (
          <option key={m.tenantId} value={m.tenantId}>
            {m.tenantName}
          </option>
        ))}
      </select>
    </form>
  );
}
