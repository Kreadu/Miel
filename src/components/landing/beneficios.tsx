import { Boxes, LineChart, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const beneficios = [
  { icon: Boxes, key: "inventory" },
  { icon: ShoppingCart, key: "trade" },
  { icon: LineChart, key: "finance" },
] as const;

export async function Beneficios() {
  const t = await getTranslations("landing.benefits");
  return (
    <section
      id="beneficios"
      className="mx-auto flex w-full max-w-4xl scroll-mt-20 flex-col gap-8 px-6 py-16"
    >
      <div className="flex flex-col gap-2 text-center" data-reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {beneficios.map(({ icon: Icon, key }, i) => (
          <Card key={key} data-reveal data-reveal-delay={i + 1}>
            <CardHeader>
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>{t(`${key}.title`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t(`${key}.description`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
