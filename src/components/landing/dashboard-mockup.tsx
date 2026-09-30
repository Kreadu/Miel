import { TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metricas = [
  { key: "sales", valor: "$18.240.000", delta: "+12%" },
  { key: "stock", valor: "1.284", delta: "+38" },
  { key: "receivable", valor: "$3.180.000", delta: "-8%" },
];

// ponytail: sparkline SVG estático server-rendered — recharts (~100 KB + hydration)
// solo si el mockup llega a necesitar interactividad real.
const barras = [28, 40, 34, 48, 44, 56, 52, 64, 58, 72, 68, 84];

export async function DashboardMockup() {
  const t = await getTranslations("landing.mockup");
  return (
    <Card className="landing-tilt w-full max-w-2xl shadow-2xl">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-3 gap-3 sm:gap-4">
          {metricas.map(({ key, valor, delta }) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="truncate text-xs text-muted-foreground">{t(key)}</dt>
              <dd className="text-right text-sm font-medium tabular-nums sm:text-base">
                {valor}
              </dd>
              <dd className="flex items-center justify-end gap-1 text-xs text-primary tabular-nums">
                <TrendingUp className="size-3" aria-hidden="true" />
                {delta}
              </dd>
            </div>
          ))}
        </dl>
        <svg
          viewBox="0 0 288 96"
          className="h-24 w-full text-primary"
          role="img"
          aria-label={t("chart")}
        >
          {barras.map((altura, i) => (
            <rect
              key={i}
              x={i * 24 + 2}
              y={96 - altura}
              width={16}
              height={altura}
              rx={3}
              fill="currentColor"
              opacity={i === barras.length - 1 ? 1 : 0.35 + i * 0.04}
            />
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
