"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

type CashFlowRow = {
  month: string | null;
  cash_in: number | null;
  cash_out: number | null;
  net_cash: number | null;
};

const chartConfig = {
  cash_in: { label: "Entradas", color: "var(--chart-5)" },
  cash_out: { label: "Salidas", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function CashFlowChart({ data }: { data: CashFlowRow[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      month: d.month || "N/A",
      cash_in: d.cash_in || 0,
      cash_out: d.cash_out || 0,
      net_cash: d.net_cash || 0,
    }));
  }, [data]);

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-4">
        <CardTitle>Flujo de Caja</CardTitle>
        <CardDescription>Entradas vs salidas por mes.</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
            No hay datos suficientes para graficar.
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
                    const data = payload[0].payload as typeof chartData[0];
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm text-sm min-w-[200px]">
                        <div className="font-semibold mb-3">{data.month}</div>
                        
                        <div className="flex items-center justify-between gap-4 py-1 text-success">
                          <span className="font-medium">Entradas</span>
                          <span className="tabular-nums">
                            {formatMoney(data.cash_in, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-1 text-destructive">
                          <span className="font-medium">Salidas</span>
                          <span className="tabular-nums">
                            {formatMoney(data.cash_out, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="my-2 border-t border-border" />
                        <div className="flex items-center justify-between gap-4 py-1 font-semibold">
                          <span>Neto</span>
                          <span className="tabular-nums">
                            {formatMoney(data.net_cash, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    );
                  }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="cash_in" name="Entradas" fill="var(--color-cash_in)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cash_out" name="Salidas" fill="var(--color-cash_out)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
