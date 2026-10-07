"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ProofState = { ok: true } | { ok: false; error: string } | null;

const E = "onlineStore.proof.errors";
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/**
 * S27-03: el cliente de la tienda (sin cuenta) sube su comprobante con la llave secreta de su
 * pedido. Storage solo deja escribir en la carpeta de un token válido; la RPC lo registra.
 */
export async function uploadPaymentProof(_prev: ProofState, formData: FormData): Promise<ProofState> {
  const token = z.guid().safeParse(formData.get("token"));
  if (!token.success) return { ok: false, error: `${E}.invalid` };

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: `${E}.fileRequired` };
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: `${E}.fileType` };
  if (file.size > MAX_PROOF_BYTES) return { ok: false, error: `${E}.fileSize` };

  const supabase = await createClient();
  const path = `${token.data}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("uploadPaymentProof upload:", uploadError.message);
    return { ok: false, error: `${E}.invalid` };
  }
  const { error } = await supabase.rpc("attach_payment_proof", { p_token: token.data, p_path: path });
  if (error) {
    console.error("uploadPaymentProof attach:", error.message);
    return { ok: false, error: `${E}.invalid` };
  }
  return { ok: true };
}
