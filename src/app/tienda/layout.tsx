import type { Metadata } from "next";

/**
 * S27-01 (marca blanca): la tienda de cada empresa no hereda la marca de Miel del layout raíz
 * (título, descripción, ícono, manifest, imagen para compartir). Cada tienda pone la suya en
 * `[slug]/page.tsx`.
 */
export const metadata: Metadata = {
  title: { absolute: " " },
  description: null,
  manifest: null,
  icons: null,
  openGraph: null,
  twitter: null,
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
