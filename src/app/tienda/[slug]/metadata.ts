import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { loadStore } from "@/lib/store/load";

/** S27-01/02: metadata marca blanca de cada página de la tienda (título, ícono, manifest). */
export async function storeMetadata(slug: string, page?: string): Promise<Metadata> {
  const store = await loadStore(slug);
  const t = await getTranslations("onlineStore");
  if (!store) return { title: { absolute: t("unavailableTitle") }, robots: { index: false } };
  const { name } = store.info;
  const icon = `/tienda/${slug}/app-icon`;
  return {
    title: { absolute: page ? `${page} · ${name}` : name },
    description: t("metaDescription", { name }),
    manifest: `/tienda/${slug}/manifest.webmanifest`,
    icons: { icon, apple: icon },
    openGraph: { title: name, siteName: name, images: [icon], type: "website" },
  };
}
