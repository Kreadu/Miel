import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import es from "../../messages/es.json";

/** E20: renderiza un componente traducido con los mensajes en español (idioma por defecto). */
export function renderIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="es" messages={es} timeZone="America/Bogota">
      {ui}
    </NextIntlClientProvider>,
  );
}
