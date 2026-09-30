import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/ui/logo";

const enlaces = [
  { href: "/login", key: "login" },
  { href: "/signup", key: "signup" },
  { href: "#beneficios", key: "benefitsLink" },
  { href: "#como-funciona", key: "howLink" },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("landing");
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo className="h-5" />
            Miel
          </span>
          <p className="text-sm text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>
        <nav aria-label={t("footer.linksLabel")} className="flex flex-col gap-2">
          {enlaces.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            © 2026 Miel. {t("footer.productOf")}{" "}
            <a
              href="https://kreadu.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4 hover:text-foreground"
            >
              KREADU S.A.S.
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
