import type { PdfLogo } from "./purchase-pdf";

const LOGO_PATH = "/storage/v1/object/public/company-logos/";
const FORMATS: Record<string, "png" | "jpg"> = { "image/png": "png", "image/jpeg": "jpg" };

/** S26-03 (anti-SSRF): solo se descarga el logo desde el bucket company-logos del propio Supabase. */
export function isCompanyLogoUrl(url: string, supabaseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    return u.origin === base.origin && u.pathname.startsWith(LOGO_PATH) && !url.includes("..");
  } catch {
    return false;
  }
}

/** Logo para el PDF, o null (sin logo, WEBP u otro formato, o falla la descarga: el PDF sale igual). */
export async function loadPdfLogo(url: string | null, supabaseUrl: string): Promise<PdfLogo> {
  if (!url || !isCompanyLogoUrl(url, supabaseUrl)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const format = FORMATS[res.headers.get("content-type")?.split(";")[0] ?? ""];
    if (!res.ok || !format) return null;
    return { data: Buffer.from(await res.arrayBuffer()), format };
  } catch {
    return null;
  }
}
