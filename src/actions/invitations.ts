"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { writeActiveTenantCookie } from "@/lib/tenant/cookie";
import { invitationSchema } from "@/lib/validation/invitations";
import { sendInvitationEmail } from "@/lib/email/invitation-email";

export type InvitationState =
  | { ok: false; error: string }
  | { ok: true; link: string }
  | null;

/** Solo owner/admin del tenant activo pueden invitar (RLS de invitations lo garantiza igual). */
export async function createInvitation(
  _prev: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  const parsed = invitationSchema.safeParse({
    email: formData.get("email"),
    access: formData.get("access"),
    worker_id: formData.get("worker_id") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tenant_id: active.tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      category_id: parsed.data.category_id,
      worker_id: parsed.data.worker_id,
    })
    .select("token")
    .single();
  if (error) {
    console.error("createInvitation:", error.code);
    return { ok: false, error: "invitations.errors.createFailed" };
  }

  const origin = (await headers()).get("origin");
  const link = `${origin}/invite/${data.token}`;
  revalidatePath("/equipo", "layout");

  // Fallo de envío no revierte la invitación: ya quedó creada y es válida vía el link (criterio 2).
  try {
    await sendInvitationEmail({
      to: parsed.data.email,
      tenantName: active.tenantName,
      role: parsed.data.role,
      link,
    });
  } catch (error) {
    console.error("createInvitation: fallo al enviar correo", error);
  }

  return { ok: true, link };
}

/** Revocar = borrar la invitación pendiente (RLS restringe a owner/admin del tenant). */
export async function revokeInvitation(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", parsed.data).is("accepted_at", null);
  revalidatePath("/equipo", "layout");
}

const acceptSchema = z.object({ token: z.uuid() });

export async function acceptInvitation(
  _prev: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  const parsed = acceptSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { ok: false, error: "invitations.errors.invalidLink" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: parsed.data.token,
  });
  if (error) {
    console.error("acceptInvitation:", error.code);
    // Genérico a propósito: sin enumeración (vencida/usada/email ajeno se ven igual).
    return { ok: false, error: "invitations.errors.invalid" };
  }

  await writeActiveTenantCookie(data);
  redirect("/inicio");
}
