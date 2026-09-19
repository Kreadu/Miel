"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          onClick={handleLogoClick}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Logo className="h-6" />
          Miel
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="!text-foreground no-underline">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild className="max-sm:hidden">
            <Link href="/signup">Crear cuenta</Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
