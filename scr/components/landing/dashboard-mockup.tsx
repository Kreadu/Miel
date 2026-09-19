import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metricas = [
  { label: "Ventas del mes", valor: "$18.240.000", delta: "+12%" },
  { label: "Ítems en stock", valor: "1.284", delta: "+38" },
  { label: "Por cobrar", valor: "$3.180.000", delta: "-8%" },
];

// ponytail: sparkline SVG estático server-rendered — recharts (~100 KB + hydration)
// solo si el mockup llega a necesitar interactividad real.
const barras = [28, 40, 34, 48, 44, 56, 52, 64, 58, 72, 68, 84];

export function DashboardMockup() {
  return (
    <Card className="landing-tilt w-full max-w-2xl shadow-2xl">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          Resumen · Julio 2026
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-3 gap-3 sm:gap-4">
          {metricas.map(({ label, valor, delta }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="truncate text-xs text-muted-foreground">{label}</dt>
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
          aria-label="Gráfico de ventas de los últimos 12 meses"
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
