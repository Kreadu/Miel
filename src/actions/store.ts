"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { STORE_COOKIE, type StoreSession, signStoreSession, verifyStoreSession } from "@/lib/tenant/store-session";

export type StoreState = { ok: false; error: string } | null;

const STORE_DAYS = 30;
const WORKER_HOURS = 12;

function secret(): string {
  return process.env.MIEL_SESSION_SECRET ?? "";
}

async function writeSession(session: StoreSession) {
  (await cookies()).set(STORE_COOKIE, signStoreSession(session, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.exp),
  });
}

async function currentSession(): Promise<StoreSession | null> {
  return verifyStoreSession((await cookies()).get(STORE_COOKIE)?.value, secret(), Date.now());
}

/**
 * S21-03 (ADR-037): pone este navegador en modo tienda. Solo una cuenta operativa: con la del
 * dueño, un trabajador con conocimientos técnicos podría hacer por debajo lo que hace el dueño.
 */
export async function activateStoreMode(): Promise<StoreState> {
  if (secret().length < 32) return { ok: false, error: "store.errors.notConfigured" };
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };
  if (active.accountRole !== "member") {
    return {
      ok: false,
      error: "store.errors.ownerCannotActivate",
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "common.errors.signInAgain" };

  await writeSession({
    userId: user.id,
    tenantId: active.tenantId,
    workerId: null,
    workerExp: null,
    exp: Date.now() + STORE_DAYS * 24 * 60 * 60 * 1000,
  });
  redirect("/trabajador");
}

const identifySchema = z.object({
  username: z.string().trim().min(1, "store.errors.usernameRequired").max(30),
  pin: z.string().regex(/^\d{4}$/, "store.errors.pinFormat"),
});

/** El trabajador se identifica con su usuario y código de 4 dígitos. */
export async function identifyWorker(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const parsed = identifySchema.safeParse({ username: formData.get("username"), pin: formData.get("pin") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const session = await currentSession();
  const { active } = await getActiveTenant();
  if (!session || !active?.storeMode) return { ok: false, error: "store.errors.notStoreMode" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_worker_pin", {
    p_tenant_id: session.tenantId,
    p_username: parsed.data.username,
    p_pin: parsed.data.pin,
  });
  if (error) {
    if (error.message.includes("locked")) {
      return { ok: false, error: "store.errors.tooManyAttempts" };
    }
    console.error("identifyWorker:", error.code);
    return { ok: false, error: "store.errors.verifyFailed" };
  }
  const worker = data?.[0];
  if (!worker) return { ok: false, error: "store.errors.invalidPin" };

  await writeSession({ ...session, workerId: worker.worker_id, workerExp: Date.now() + WORKER_HOURS * 60 * 60 * 1000 });
  redirect("/inicio");
}

/** "Cambiar trabajador": deja el equipo en modo tienda esperando otro código. */
export async function releaseWorker(): Promise<void> {
  const session = await currentSession();
  if (session) await writeSession({ ...session, workerId: null, workerExp: null });
  redirect("/trabajador");
}

const exitSchema = z.object({ password: z.string().min(1, "store.errors.passwordRequired") });

/**
 * Salir del modo tienda exige la contraseña de la cuenta: si no, cualquier trabajador podría
 * salir y usar la cuenta de la tienda sin restricción de categoría.
 */
export async function exitStoreMode(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const parsed = exitSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "common.errors.signInAgain" };

  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
  if (error) return { ok: false, error: "store.errors.wrongPassword" };

  (await cookies()).delete(STORE_COOKIE);
  redirect("/inicio");
}
