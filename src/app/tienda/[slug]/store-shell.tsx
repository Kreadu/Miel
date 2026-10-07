import { getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";

import { readableOn, storeColor } from "@/lib/store/color";
import type { StoreInfo } from "@/lib/store/load";

import { StoreHeader } from "./store-header";

/** S27-01/02: marco de la tienda — color de la empresa, encabezado y pie con su contacto. */
export async function StoreShell({ slug, info, children }: { slug: string; info: StoreInfo; children: ReactNode }) {
  const t = await getTranslations("onlineStore");
  const color = storeColor(info.store_color);
  const style = { "--store": color, "--store-fg": readableOn(color) } as CSSProperties;
  const place = [info.address, info.city].filter(Boolean).join(", ");

  return (
    <div style={style} className="flex min-h-dvh flex-col bg-background text-foreground">
      <StoreHeader slug={slug} name={info.name} logoUrl={info.logo_url} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
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
