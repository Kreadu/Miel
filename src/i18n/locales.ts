/**
 * Constantes de locale sin dependencias de servidor (`next/headers`) — separado de
 * `request.ts` a propósito, para que un componente cliente (p. ej. `LanguageSwitcher`) pueda
 * importar `Locale`/`LOCALE_COOKIE` sin arrastrar código server-only a su bundle.
 */
export const LOCALES = ["es", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "miel-locale";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
