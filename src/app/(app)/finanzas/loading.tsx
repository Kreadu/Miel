import { Loader2 } from "lucide-react";

export default function FinanzasLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
