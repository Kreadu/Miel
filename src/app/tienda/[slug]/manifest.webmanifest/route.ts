import { storeColor } from "@/lib/store/color";
import { loadStore } from "@/lib/store/load";

/** S27-01: la tienda se instala como app con el nombre, color e ícono de la empresa. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) return new Response("Not found", { status: 404 });

  const color = storeColor(store.info.store_color);
  const base = `/tienda/${slug}`;
  return Response.json(
    {
      name: store.info.name,
      short_name: store.info.name.slice(0, 30),
      start_url: base,
      scope: base,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: color,
      icons: [{ src: `${base}/app-icon`, sizes: "512x512", type: "image/png" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
