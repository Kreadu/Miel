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
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ tenant_id: active.tenantId, email: parsed.data.email, role: parsed.data.role })
    .select("token")
    .single();
  if (error) {
    console.error("createInvitation:", error.code);
    return { ok: false, error: "No se pudo crear la invitación. Intenta de nuevo." };
  }

  const origin = (await headers()).get("origin");
  const link = `${origin}/invite/${data.token}`;
  revalidatePath("/equipo");

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
  revalidatePath("/equipo");
}

const acceptSchema = z.object({ token: z.uuid() });

export async function acceptInvitation(
  _prev: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  const parsed = acceptSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { ok: false, error: "Enlace de invitación inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: parsed.data.token,
  });
  if (error) {
    console.error("acceptInvitation:", error.code);
    // Genérico a propósito: sin enumeración (vencida/usada/email ajeno se ven igual).
    return { ok: false, error: "Esta invitación no es válida o ya fue usada." };
  }

  await writeActiveTenantCookie(data);
  redirect("/inicio");
}
