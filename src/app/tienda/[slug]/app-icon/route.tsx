import { ImageResponse } from "next/og";

import { isCompanyLogoUrl } from "@/lib/purchases/pdf-logo";
import { readableOn, storeColor } from "@/lib/store/color";
import { loadStore } from "@/lib/store/load";

/**
 * S27-01: ícono de la tienda (pestaña y app instalada). Logo PNG/JPG de la empresa sobre blanco;
 * sin logo (o WEBP, que el generador no lee), la inicial sobre el color de la empresa. El logo
 * solo se descarga del bucket propio (anti-SSRF, igual que el PDF).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) return new Response("Not found", { status: 404 });

  const { name, logo_url } = store.info;
  const color = storeColor(store.info.store_color);
  const logo =
    logo_url && isCompanyLogoUrl(logo_url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") && /\.(png|jpe?g)$/i.test(logo_url)
      ? logo_url
      : null;

  return new ImageResponse(
    logo ? (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={logo} alt="" width={420} height={420} style={{ objectFit: "contain" }} />
      </div>
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: readableOn(color),
          fontSize: 300,
          fontWeight: 700,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    ),
    { width: 512, height: 512 },
  );
}
