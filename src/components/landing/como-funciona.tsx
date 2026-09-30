import { Building2, Rocket, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

const pasos = [
  { icon: UserPlus, key: "signup" },
  { icon: Building2, key: "setup" },
  { icon: Rocket, key: "operate" },
] as const;

export async function ComoFunciona() {
  const t = await getTranslations("landing.how");
  return (
    <section
      id="como-funciona"
      className="mx-auto flex w-full max-w-4xl scroll-mt-20 flex-col gap-8 px-6 py-16"
    >
      <div className="flex flex-col gap-2 text-center" data-reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {pasos.map(({ icon: Icon, key }, i) => (
          <li
            key={key}
            className="flex flex-col items-center gap-3 text-center"
            data-reveal
            data-reveal-delay={i + 1}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary tabular-nums">
              {i + 1}
            </span>
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold tracking-tight">{t(`${key}.title`)}</h3>
            <p className="text-sm text-muted-foreground">{t(`${key}.description`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
