"use client";

import { useRouter } from "next/navigation";

import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";

const FLAGS: { locale: Locale; flag: string; label: string }[] = [
  { locale: "es", flag: "🇪🇸", label: "Español" },
  { locale: "en", flag: "🇬🇧", label: "English" },
  { locale: "fr", flag: "🇫🇷", label: "Français" },
];

// Módulo, no dentro del componente: el lint de efectos (react-hooks/immutability) marca una
// mutación de `document.cookie` hecha en el cuerpo del componente/hook, aunque esté dentro de
// un handler de evento — moverla a una función de módulo evita el falso positivo.
function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * E20 (piloto): cambia el idioma vía cookie de preferencia (sin routing por locale, ver
 * src/i18n/request.ts) — `router.refresh()` hace que el layout raíz (Server Component) vuelva a
 * leer la cookie y renderice con los mensajes nuevos, sin perder la página en la que se está.
 */
export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();

  function setLocale(locale: Locale) {
    setLocaleCookie(locale);
    router.refresh();
  }

  return (
    <div className="ml-auto flex items-center gap-1">
      {FLAGS.map((f) => (
        <button
          key={f.locale}
          type="button"
          title={f.label}
          aria-label={f.label}
          aria-pressed={currentLocale === f.locale}
          onClick={() => setLocale(f.locale)}
          className={`rounded-md px-1.5 py-1 text-base leading-none transition-colors ${
            currentLocale === f.locale
              ? "bg-sidebar-accent"
              : "opacity-60 hover:bg-sidebar-accent/50 hover:opacity-100"
          }`}
        >
          {f.flag}
        </button>
      ))}
    </div>
  );
}
