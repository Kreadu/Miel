export default function CustomerHistoryLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div>
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="mt-2 h-4 w-48 rounded bg-muted" />
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-4 h-8 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Timeline Skeleton */}
      <div className="rounded-lg border border-border bg-card p-6 mt-4">
        <div className="h-5 w-32 rounded bg-muted mb-6" />
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-muted" />
              <div className="flex-1 border-b border-border pb-4">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="mt-2 h-3 w-32 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
