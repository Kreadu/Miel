import { DEVELOPER, whatsappUrl } from "@/lib/platform/developer";

/** S27-08: pie fijo de Kreadu (desarrollador de Miel) en todas las tiendas (ADR-045), en una franja pequeña. */
export function DeveloperFooter() {
  const { company, contact, social } = DEVELOPER;
  const sep = <span aria-hidden="true">·</span>;
  return (
    <div className="border-t border-border bg-muted/40">
      <p className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-3 text-center text-xs leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">{DEVELOPER.brand}</span>
        <span>{DEVELOPER.legal}</span>
        {company.links.map((l) => (
          <span key={l.label} className="contents">
            {sep}
            {l.url ? (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {l.label}
              </a>
            ) : (
              <span>{l.label}</span>
            )}
          </span>
        ))}
        {sep}
        <a href={`mailto:${contact.email}`} className="hover:underline">
          {contact.cta}
        </a>
        <a href={`mailto:${contact.email}`} className="hover:underline">
          {contact.email}
        </a>
        {contact.phones.map((p) => (
          <a key={p} href={whatsappUrl(p)} target="_blank" rel="noopener noreferrer" className="tabular-nums hover:underline">
            {p}
          </a>
        ))}
        {social.links.map((l) => (
          <span key={l.url} className="contents">
            {sep}
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {l.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
