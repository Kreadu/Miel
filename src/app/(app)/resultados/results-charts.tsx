"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

export type ChartMonth = {
  label: string;
  income: number;
  netProfit: number;
  gross: number | null;
  operating: number | null;
  net: number | null;
};

const moneyConfig = {
  income: { label: "Ventas", color: "var(--chart-1)" },
  netProfit: { label: "Utilidad neta", color: "var(--chart-2)" },
} satisfies ChartConfig;

const marginConfig = {
  gross: { label: "Margen bruto", color: "var(--chart-1)" },
  operating: { label: "Margen operativo", color: "var(--chart-2)" },
  net: { label: "Margen neto", color: "var(--chart-3)" },
} satisfies ChartConfig;

const compact = (n: number) =>
  new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const percent = (n: number) => `${n.toFixed(1)}%`;

/** S22-03: evolución mes a mes del rango — dinero (un eje) y márgenes (un eje, %). */
export function ResultsCharts({ data }: { data: ChartMonth[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-medium">Ventas y utilidad neta por mes</figcaption>
        <ChartContainer config={moneyConfig} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <ChartTooltip
              cursor={{ fill: "var(--color-muted)" }}
              content={<ChartTooltipContent formatter={(v, name) => `${moneyConfig[name as keyof typeof moneyConfig]?.label ?? name}: ${formatMoney(Number(v))}`} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="netProfit" fill="var(--color-netProfit)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      </figure>

      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-medium">Márgenes por mes (% de las ventas)</figcaption>
        <ChartContainer config={marginConfig} className="aspect-auto h-64 w-full">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={percent} />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v, name) => `${marginConfig[name as keyof typeof marginConfig]?.label ?? name}: ${percent(Number(v))}`} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {(["gross", "operating", "net"] as const).map((key) => (
              <Line
                key={key}
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </figure>
    </div>
  );
}
