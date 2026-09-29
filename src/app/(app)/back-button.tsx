"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * S19-12: un solo lugar (el layout compartido de (app)) en vez de agregarlo a cada página —
 * aparece en todas menos /inicio, que ya tiene su propia forma de "volver" (el logo, S14-03).
 * El margen inferior lo pone el contenedor en layout.tsx (comparte fila con LanguageSwitcher).
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("backButton");

  if (pathname === "/inicio") return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} className="w-fit -ml-2">
      <ArrowLeft className="mr-1 h-4 w-4" />
      {t("label")}
    </Button>
  );
}
