import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function GastosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
      </div>

      <Card>
        <CardHeader className="h-16 animate-pulse border-b border-border bg-muted/50" />
        <CardContent className="p-0">
          <div className="flex flex-col">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex h-14 items-center gap-4 border-b border-border px-4 py-3 last:border-0"
              >
                <div className="h-4 w-1/4 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
