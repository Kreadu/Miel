"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { parentPath } from "@/lib/navigation/parent-path";

/**
 * S19-12: un solo lugar (el layout compartido de (app)) en vez de agregarlo a cada página —
 * aparece en todas menos /inicio, que ya tiene su propia forma de "volver" (el logo, S14-03).
 * S19-33: sube a la sección de arriba (`parentPath`), no al historial del navegador.
 * El margen inferior lo pone el contenedor en layout.tsx (comparte fila con LanguageSwitcher).
 */
export function BackButton() {
  const pathname = usePathname();
  const t = useTranslations("backButton");

  if (pathname === "/inicio") return null;

  return (
    <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
      <Link href={parentPath(pathname)}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t("label")}
      </Link>
    </Button>
  );
}
