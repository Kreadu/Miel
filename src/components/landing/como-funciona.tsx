import { Building2, Rocket, UserPlus } from "lucide-react";

const pasos = [
  {
    icon: UserPlus,
    titulo: "Regístrate",
    descripcion: "Crea tu cuenta con tu correo. Sin costo inicial.",
  },
  {
    icon: Building2,
    titulo: "Configura tu empresa",
    descripcion: "Nombre, bodegas y productos. Guiado, sin manuales.",
  },
  {
    icon: Rocket,
    titulo: "Opera",
    descripcion: "Compra, vende y cobra. El dashboard se arma solo.",
  },
];

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="mx-auto flex w-full max-w-4xl scroll-mt-20 flex-col gap-8 px-6 py-16"
    >
      <div className="flex flex-col gap-2 text-center" data-reveal>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Cómo funciona
        </h2>
        <p className="text-muted-foreground">
          De cero a operar en tres pasos.
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {pasos.map(({ icon: Icon, titulo, descripcion }, i) => (
          <li
            key={titulo}
            className="flex flex-col items-center gap-3 text-center"
            data-reveal
            data-reveal-delay={i + 1}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary tabular-nums">
              {i + 1}
            </span>
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold tracking-tight">{titulo}</h3>
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
