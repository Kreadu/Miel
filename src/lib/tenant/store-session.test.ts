import { describe, expect, it } from "vitest";

import { signStoreSession, verifyStoreSession } from "./store-session";

const SECRET = "x".repeat(32);
const NOW = 1_800_000_000_000;
const payload = { userId: "u-1", tenantId: "t-1", workerId: "w-1", workerExp: NOW + 60_000, exp: NOW + 3_600_000 };

describe("sesión del equipo de la tienda (S21-03)", () => {
  it("firma y verifica el mismo contenido", () => {
    const token = signStoreSession(payload, SECRET);
    expect(verifyStoreSession(token, SECRET, NOW)).toEqual(payload);
  });

  it("rechaza un token alterado o firmado con otra clave", () => {
    const token = signStoreSession(payload, SECRET);
    const [body, sig] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...payload, workerId: "w-2" })).toString("base64url");
    expect(verifyStoreSession(`${tampered}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyStoreSession(token, "y".repeat(32), NOW)).toBeNull();
    expect(verifyStoreSession(`${body}`, SECRET, NOW)).toBeNull();
  });

  it("vencido → nulo; trabajador vencido → sigue el modo tienda sin trabajador", () => {
    expect(verifyStoreSession(signStoreSession(payload, SECRET), SECRET, NOW + 3_600_001)).toBeNull();
    expect(verifyStoreSession(signStoreSession(payload, SECRET), SECRET, NOW + 60_001)).toEqual({
      ...payload,
      workerId: null,
      workerExp: null,
    });
  });

  it("sin clave secreta configurada no hay modo tienda", () => {
    expect(() => signStoreSession(payload, "")).toThrow();
    expect(verifyStoreSession(signStoreSession(payload, SECRET), "", NOW)).toBeNull();
  });
});
