import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export function BrandLink() {
  return (
    <Link
      href="/inicio"
      className="flex min-h-10 w-fit items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-primary outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Logo className="h-6 w-auto" />
      Miel
    </Link>
  );
}
