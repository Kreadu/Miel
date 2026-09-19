export default function AppLoading() {
  return (
    <div className="flex min-h-svh">
      <aside className="flex w-60 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4">
        <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        <div className="flex flex-col gap-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
      </main>
    </div>
  );
}
