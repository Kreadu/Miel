import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// CSP (ADR-020). `unsafe-inline`/`unsafe-eval` en script-src: lo exige Next sin nonces
// (dev necesita eval; los chunks inyectan inline). Aceptado para el MVP, nonces en Fase 2
// (ADR-024).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions limitan el body a 1MB por defecto — las fotos del catálogo (S19-02)
      // aceptan hasta 5MB (validado en el servidor, ver src/lib/validation/catalog.ts), así
      // que el límite del framework tiene que ser mayor a eso (margen para el resto del
      // multipart/form-data, no solo el archivo).
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
