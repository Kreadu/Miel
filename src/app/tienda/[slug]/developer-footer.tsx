import { DEVELOPER, whatsappUrl } from "@/lib/platform/developer";

/** S27-08: pie fijo de Kreadu (desarrollador de Miel) en todas las tiendas (ADR-045). */
export function DeveloperFooter() {
  const { company, contact, social } = DEVELOPER;
  return (
    <div className="border-t border-border bg-muted/40">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold tracking-tight">{DEVELOPER.brand}</p>
          <p className="text-xs text-muted-foreground">{DEVELOPER.legal}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{company.title}</p>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {company.links.map((l) => (
              <li key={l.label}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {l.label}
                  </a>
                ) : (
                  l.label
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{contact.title}</p>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>
              <a href={`mailto:${contact.email}`} className="hover:underline">
                {contact.cta}
              </a>
            </li>
            <li>
              <a href={`mailto:${contact.email}`} className="hover:underline">
                {contact.email}
              </a>
            </li>
            {contact.phones.map((p) => (
              <li key={p}>
                <a href={whatsappUrl(p)} target="_blank" rel="noopener noreferrer" className="tabular-nums hover:underline">
                  {p}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {social.links.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="font-medium">{social.title}</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {social.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
