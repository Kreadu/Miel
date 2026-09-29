import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

/**
 * E20 (piloto): sin routing por locale — no se usa `/[locale]/...`, así que ningún link/redirect
 * existente cambia. El idioma vive en una cookie de preferencia, leída acá server-side. Alcance
 * de este piloto: menú lateral + Catálogo (ver docs/BACKLOG.md, Épica E20) — el resto de la app
 * sigue en español hasta que se traduzca módulo por módulo.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
