import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

const LINK_CLASS =
  "flex min-h-10 w-fit items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-primary outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50";

/** S26-05: si la empresa subió su logo (Mi empresa), va en lugar del de Miel. */
export function BrandLink({ logoUrl, companyName }: { logoUrl?: string | null; companyName?: string }) {
  if (logoUrl) {
    return (
      <Link href="/inicio" className={LINK_CLASS}>
        <span className="relative block h-10 w-32">
          <Image src={logoUrl} alt={companyName ?? ""} fill unoptimized className="object-contain object-left" />
        </span>
      </Link>
    );
  }
  return (
    <Link href="/inicio" className={LINK_CLASS}>
      <Logo className="h-6 w-auto" />
      Miel
    </Link>
  );
}
