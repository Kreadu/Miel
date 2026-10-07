import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { isLocale } from "@/i18n/locales";
import { readableOn, storeColor } from "@/lib/store/color";
import { loadStore } from "@/lib/store/load";

import { StoreCatalog } from "./store-catalog";

type Props = { params: Promise<{ slug: string }> };

/** S27-01: marca blanca — título, ícono e instalación con la empresa; nada de Miel. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStore(slug);
  const t = await getTranslations("onlineStore");
  if (!store) return { title: { absolute: t("unavailableTitle") }, robots: { index: false } };
  const icon = `/tienda/${slug}/app-icon`;
  return {
    title: { absolute: store.info.name },
    description: t("metaDescription", { name: store.info.name }),
    manifest: `/tienda/${slug}/manifest.webmanifest`,
    icons: { icon, apple: icon },
    openGraph: { title: store.info.name, siteName: store.info.name, images: [icon], type: "website" },
  };
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();

  const { info, products } = store;
  const t = await getTranslations("onlineStore");
  const locale = await getLocale();
  const color = storeColor(info.store_color);
  const style = { "--store": color, "--store-fg": readableOn(color) } as CSSProperties;
  const place = [info.address, info.city].filter(Boolean).join(", ");

  return (
    <div style={style} className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          {info.logo_url ? (
            <div className="relative h-10 w-24 shrink-0">
              <Image src={info.logo_url} alt={info.name} fill unoptimized className="object-contain object-left" />
            </div>
          ) : (
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--store) text-lg font-semibold text-(--store-fg)"
            >
              {info.name.charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{info.name}</h1>
          <LanguageSwitcher currentLocale={isLocale(locale) ? locale : "es"} />
        </div>
        <div className="h-1 bg-(--store)" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <StoreCatalog products={products} currency={info.currency} />
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{info.name}</p>
          {place ? <p>{place}</p> : null}
          {info.phone ? (
            <p>
              {t("phone")}: <a className="underline" href={`tel:${info.phone}`}>{info.phone}</a>
            </p>
          ) : null}
          {info.email ? (
            <p>
              {t("email")}: <a className="underline" href={`mailto:${info.email}`}>{info.email}</a>
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
