/**
 * S27-10: celular con código de país en la tienda. Colombia primero; después América, España y
 * EE. UU. (la bandera es el emoji del país).
 */
export const COUNTRY_CODES = [
  { iso: "CO", dial: "+57", flag: "🇨🇴" },
  { iso: "US", dial: "+1", flag: "🇺🇸" },
  { iso: "ES", dial: "+34", flag: "🇪🇸" },
  { iso: "MX", dial: "+52", flag: "🇲🇽" },
  { iso: "VE", dial: "+58", flag: "🇻🇪" },
  { iso: "EC", dial: "+593", flag: "🇪🇨" },
  { iso: "PE", dial: "+51", flag: "🇵🇪" },
  { iso: "PA", dial: "+507", flag: "🇵🇦" },
  { iso: "CL", dial: "+56", flag: "🇨🇱" },
  { iso: "AR", dial: "+54", flag: "🇦🇷" },
  { iso: "BR", dial: "+55", flag: "🇧🇷" },
  { iso: "BO", dial: "+591", flag: "🇧🇴" },
  { iso: "PY", dial: "+595", flag: "🇵🇾" },
  { iso: "UY", dial: "+598", flag: "🇺🇾" },
  { iso: "CR", dial: "+506", flag: "🇨🇷" },
  { iso: "DO", dial: "+1809", flag: "🇩🇴" },
  { iso: "GT", dial: "+502", flag: "🇬🇹" },
  { iso: "HN", dial: "+504", flag: "🇭🇳" },
  { iso: "SV", dial: "+503", flag: "🇸🇻" },
  { iso: "NI", dial: "+505", flag: "🇳🇮" },
  { iso: "CU", dial: "+53", flag: "🇨🇺" },
  { iso: "PR", dial: "+1787", flag: "🇵🇷" },
  { iso: "CA", dial: "+1", flag: "🇨🇦" },
] as const;

export const DIAL_CODES = new Set<string>(COUNTRY_CODES.map((c) => c.dial));

/** "+57" + "310 555-0001" → "+57 3105550001". */
export function internationalPhone(dial: string, local: string): string {
  return `${dial} ${local.replace(/\D/g, "")}`;
}
