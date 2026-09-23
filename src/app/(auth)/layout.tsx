import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HexPattern } from "@/components/landing/hex-pattern";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <HexPattern
        id="hex-auth"
        style={{
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="absolute top-4 left-4 z-10 sm:top-6 sm:left-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </Button>
      </div>
      <Link
        href="/"
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <Logo className="h-8 w-auto" />
        <span className="text-2xl font-semibold tracking-tight text-primary">Miel</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
