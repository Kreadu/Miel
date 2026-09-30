"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

type PnlRow = {
  month: string | null;
  income: number | null;
  cogs: number | null;
  expenses: number | null;
  utility: number | null;
};

export function PnlChart({ data }: { data: PnlRow[] }) {
  const t = useTranslations("finance");
  const chartConfig = {
    income: { label: t("pnl.income"), color: "var(--chart-1)" },
    cogs: { label: t("pnl.cogs"), color: "var(--chart-2)" },
    expenses: { label: t("pnl.expenses"), color: "var(--chart-3)" },
    utility: { label: t("pnl.utility"), color: "var(--chart-4)" },
  } satisfies ChartConfig;
  const chartData = useMemo(() => {
    return data.map((d) => ({
      month: d.month || "N/A",
      income: d.income || 0,
      cogs: d.cogs || 0,
      expenses: d.expenses || 0,
      utility: d.utility || 0,
    }));
  }, [data]);

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-4">
        <CardTitle>{t("pnl.title")}</CardTitle>
        <CardDescription>{t("pnl.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
            {t("noData")}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickMargin={10}
                  stroke="var(--color-muted-foreground)"
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                        <div className="font-semibold mb-2">{payload[0].payload.month}</div>
                        {payload.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-muted-foreground">{item.name}</span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {formatMoney(Number(item.value), { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name={t("pnl.income")} fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name={t("pnl.cogs")} fill="var(--color-cogs)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={t("pnl.expenses")} fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
