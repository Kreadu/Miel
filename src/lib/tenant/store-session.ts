import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * S21-03 (ADR-037): sesión del equipo de la tienda. Una cookie firmada (HMAC-SHA256 con
 * MIEL_SESSION_SECRET) dice que este navegador está en "modo tienda" para una cuenta y empresa,
 * y qué trabajador se identificó con su código. No da permisos de base de datos: la sesión real
 * sigue siendo la de la cuenta de tienda (operativa); la cookie solo restringe lo que se muestra.
 */
export type StoreSession = {
  userId: string;
  tenantId: string;
  workerId: string | null;
  workerExp: number | null;
  exp: number;
};

export const STORE_COOKIE = "miel_store";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signStoreSession(session: StoreSession, secret: string): string {
  if (secret.length < 32) throw new Error("MIEL_SESSION_SECRET no está configurada.");
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Devuelve la sesión si la firma es válida y no venció; el trabajador vence por separado. */
export function verifyStoreSession(token: string | undefined, secret: string, now: number): StoreSession | null {
  if (!token || secret.length < 32) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString()) as StoreSession;
    if (typeof session.exp !== "number" || session.exp < now) return null;
    if (!session.workerExp || session.workerExp < now) {
      return { ...session, workerId: null, workerExp: null };
    }
    return session;
  } catch {
    return null;
  }
}
