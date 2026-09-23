import { describe, expect, it } from "vitest";

import { resolveActiveTenant, type ActiveMembership } from "./active-tenant";

const tenantA: ActiveMembership = { tenantId: "a", role: "owner", tenantName: "Empresa A" };
const tenantB: ActiveMembership = { tenantId: "b", role: "member", tenantName: "Empresa B" };

describe("resolveActiveTenant", () => {
  it("usa el tenant de la cookie cuando corresponde a un membership del usuario", () => {
    expect(resolveActiveTenant([tenantA, tenantB], "b")).toEqual(tenantB);
  });

  it("descarta una cookie de tenant ajeno o inexistente y cae al primero", () => {
    expect(resolveActiveTenant([tenantA, tenantB], "ajeno-o-inexistente")).toEqual(tenantA);
  });

  it("sin cookie, usa el primer membership del usuario", () => {
    expect(resolveActiveTenant([tenantA, tenantB], undefined)).toEqual(tenantA);
  });

  it("sin memberships, devuelve null", () => {
    expect(resolveActiveTenant([], "a")).toBeNull();
  });
});
