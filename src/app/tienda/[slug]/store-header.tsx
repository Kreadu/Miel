import Image from "next/image";
import Link from "next/link";
import { getLocale } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { isLocale } from "@/i18n/locales";

import { CartButton } from "./cart-button";

/** S27-01/02: encabezado marca blanca de la tienda (logo o inicial, nombre, idioma, carrito). */
export async function StoreHeader({ slug, name, logoUrl }: { slug: string; name: string; logoUrl: string | null }) {
  const locale = await getLocale();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <Link href={`/tienda/${slug}`} className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <span className="relative block h-10 w-24 shrink-0">
              <Image src={logoUrl} alt={name} fill unoptimized className="object-contain object-left" />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--store) text-lg font-semibold text-(--store-fg)"
            >
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-base font-semibold tracking-tight">{name}</span>
        </Link>
        <LanguageSwitcher currentLocale={isLocale(locale) ? locale : "es"} />
        <CartButton slug={slug} />
      </div>
      <div className="h-1 bg-(--store)" />
    </header>
  );
}
