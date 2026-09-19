import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TenantSwitcher } from "./tenant-switcher";

afterEach(cleanup);

const membership = (tenantId: string, tenantName: string) => ({
  tenantId,
  tenantName,
  role: "owner" as const,
});

describe("TenantSwitcher", () => {
  it("con 1 sola membership no renderiza nada", () => {
    const { container } = render(
      <TenantSwitcher
        memberships={[membership("t1", "Empresa Única")]}
        activeTenantId="t1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("con 2+ memberships renderiza el selector con ambas empresas", () => {
    render(
      <TenantSwitcher
        memberships={[membership("t1", "Empresa A"), membership("t2", "Empresa B")]}
        activeTenantId="t1"
      />,
    );
    const select = screen.getByLabelText("Empresa activa");
    expect(select.querySelectorAll("option")).toHaveLength(2);
  });
});
