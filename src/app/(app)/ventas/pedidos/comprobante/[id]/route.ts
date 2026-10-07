import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const notFound = () => new Response("No encontrado", { status: 404 });

/**
 * S27-03: abre el comprobante de pago que subió el cliente de la tienda. La RLS de `sales` decide
 * quién ve el pedido, y la de Storage quién lee el archivo; el enlace firmado vence en 5 minutos.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) return notFound();

  const supabase = await createClient();
  const { data: sale } = await supabase.from("sales").select("payment_proof_path").eq("id", id).maybeSingle();
  if (!sale?.payment_proof_path) return notFound();

  const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(sale.payment_proof_path, 300);
  if (!data?.signedUrl) return notFound();
  return NextResponse.redirect(data.signedUrl);
}
