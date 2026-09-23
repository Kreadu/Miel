import { Boxes, LineChart, ShoppingCart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const beneficios = [
  {
    icon: Boxes,
    titulo: "Inventario en tiempo real",
    descripcion: "Stock, kardex y alertas de mínimos siempre al día, por bodega.",
  },
  {
    icon: ShoppingCart,
    titulo: "Compras y ventas claras",
    descripcion:
      "Órdenes, recepciones y POS con cuentas por pagar y por cobrar al día.",
  },
  {
    icon: LineChart,
    titulo: "Finanzas y dashboard",
    descripcion:
      "P&L, flujo de caja y métricas gerenciales sin armar hojas de cálculo.",
  },
];

export function Beneficios() {
  return (
    <section
      id="beneficios"
      className="mx-auto flex w-full max-w-4xl scroll-mt-20 flex-col gap-8 px-6 py-16"
    >
      <div className="flex flex-col gap-2 text-center" data-reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Todo tu negocio, en una sola pantalla
        </h2>
        <p className="text-muted-foreground">
          Lo que hoy vive en hojas de cálculo y cuadernos, ordenado y al día.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {beneficios.map(({ icon: Icon, titulo, descripcion }, i) => (
          <Card key={titulo} data-reveal data-reveal-delay={i + 1}>
            <CardHeader>
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>{titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{descripcion}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
