"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

type ExpenseRow = {
  month: string | null;
  category: string | null;
  kind: string | null;
  amount: number | null;
};

const chartConfig = {
  fixed: { label: "Fijo", color: "var(--chart-1)" },
  variable: { label: "Variable", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ExpensesChart({ data }: { data: ExpenseRow[] }) {
  const chartData = useMemo(() => {
    // Agrupar por mes
    const map = new Map<string, { month: string; fixed: number; variable: number; categories: { category: string; amount: number; kind: string }[] }>();
    
    for (const row of data) {
      if (!row.month) continue;
      const amount = row.amount || 0;
      
      let entry = map.get(row.month);
      if (!entry) {
        entry = { month: row.month, fixed: 0, variable: 0, categories: [] };
        map.set(row.month, entry);
      }
      
      if (row.kind === "fixed") {
        entry.fixed += amount;
      } else {
        entry.variable += amount;
      }
      
      entry.categories.push({ category: row.category || "General", amount, kind: row.kind || "variable" });
    }
    
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-4">
        <CardTitle>Gastos Mensuales</CardTitle>
        <CardDescription>Proporción de gastos fijos vs variables.</CardDescription>
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
                      <div className="rounded-lg border bg-background p-3 shadow-sm text-sm min-w-[250px]">
                        <div className="font-semibold mb-3">{data.month}</div>
                        
                        <div className="flex items-center justify-between gap-4 py-1">
                          <div className="flex items-center gap-1.5 font-medium">
                            <div className="h-2 w-2 rounded-full bg-[var(--color-fixed)]" />
                            Fijo
                          </div>
                          <span className="tabular-nums">
                            {formatMoney(data.fixed, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-1">
                          <div className="flex items-center gap-1.5 font-medium">
                            <div className="h-2 w-2 rounded-full bg-[var(--color-variable)]" />
                            Variable
                          </div>
                          <span className="tabular-nums">
                            {formatMoney(data.variable, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        
                        {data.categories.length > 0 && (
                          <>
                            <div className="my-2 border-t border-border" />
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Por categoría</div>
                            <div className="space-y-1">
                              {[...data.categories].sort((a, b) => b.amount - a.amount).map((cat, i) => (
                                <div key={i} className="flex items-center justify-between gap-4 text-xs">
                                  <span className="text-muted-foreground capitalize truncate max-w-[120px]">
                                    {cat.category}
                                  </span>
                                  <span className="tabular-nums text-muted-foreground">
                                    {formatMoney(cat.amount, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="fixed" name="Fijo" stackId="a" fill="var(--color-fixed)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="variable" name="Variable" stackId="a" fill="var(--color-variable)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
