import Link from "next/link";

import { Logo } from "@/components/ui/logo";

const enlaces = [
  { href: "/login", label: "Iniciar sesión" },
  { href: "/signup", label: "Crear cuenta" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#como-funciona", label: "Cómo funciona" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo className="h-5" />
            Miel
          </span>
          <p className="text-sm text-muted-foreground">
            El ERP simple para pymes.
          </p>
        </div>
        <nav aria-label="Enlaces del sitio" className="flex flex-col gap-2">
          {enlaces.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            © 2026 Miel. Un producto de{" "}
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
