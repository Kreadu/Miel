import { cn } from "@/lib/utils";

// Panal decorativo de fondo: pattern SVG de hexágonos en el acento del sistema,
// desvanecido con mask y con drift vertical en loop (motion-safe, ver globals.css).
// `id` debe ser único por instancia en la página (ids de <pattern> en el DOM).
export function HexPattern({
  id,
  className,
  style,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden text-primary",
        className,
      )}
      style={{
        maskImage:
          "radial-gradient(ellipse 90% 70% at 50% 35%, black 30%, transparent 75%)",
        ...style,
      }}
    >
      <svg className="landing-hex-drift absolute -top-24 left-0 h-[calc(100%+96px)] w-full opacity-[0.12] dark:opacity-[0.05]">
        <defs>
          <path
            id={`${id}-cell`}
            d="M28 0 56 16v32L28 64 0 48V16z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <pattern
            id={id}
            width="56"
            height="96"
            patternUnits="userSpaceOnUse"
          >
            <use href={`#${id}-cell`} />
            <use href={`#${id}-cell`} x="-28" y="48" />
            <use href={`#${id}-cell`} x="28" y="48" />
            <use href={`#${id}-cell`} x="-28" y="-48" />
            <use href={`#${id}-cell`} x="28" y="-48" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
