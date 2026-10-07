/** S27-01: color de la marca de la empresa en su tienda (marca blanca, no un token de Miel). */
export const DEFAULT_STORE_COLOR = "#374151";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Solo hex válido llega al CSS inline (la BD ya lo exige; esto evita inyectar CSS igual). */
export function storeColor(color: string | null | undefined): string {
  return color && HEX.test(color) ? color : DEFAULT_STORE_COLOR;
}

/** Texto legible sobre el color (luminancia relativa WCAG, umbral ~0.18). */
export function readableOn(hex: string): "#ffffff" | "#000000" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
