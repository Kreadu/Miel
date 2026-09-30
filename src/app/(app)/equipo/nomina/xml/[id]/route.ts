import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * S21-05: descarga el XML de nómina electrónica de una liquidación. RLS de payroll_settlements
 * (solo owner/admin) decide quién puede leerlo; id ajeno o inexistente → 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll_settlements")
    .select("dian_xml, dian_consecutive")
    .eq("id", id)
    .maybeSingle();
  if (!data?.dian_xml) return new Response("No encontrado", { status: 404 });

  const filename = `NE${String(data.dian_consecutive).padStart(8, "0")}.xml`;
  return new Response(data.dian_xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
