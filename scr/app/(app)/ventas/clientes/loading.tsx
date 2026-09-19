export default function ClientesLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div>
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="mt-2 h-4 w-48 rounded bg-muted" />
      </div>

      <div className="h-9 w-32 rounded bg-muted" />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2"><div className="h-4 w-24 rounded bg-muted" /></th>
              <th className="px-3 py-2"><div className="h-4 w-24 rounded bg-muted" /></th>
              <th className="px-3 py-2"><div className="h-4 w-32 rounded bg-muted" /></th>
              <th className="px-3 py-2"><div className="h-4 w-24 rounded bg-muted" /></th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-3"><div className="h-4 w-32 rounded bg-muted" /></td>
                <td className="px-3 py-3"><div className="h-4 w-24 rounded bg-muted" /></td>
                <td className="px-3 py-3"><div className="h-4 w-40 rounded bg-muted" /></td>
                <td className="px-3 py-3"><div className="h-4 w-24 rounded bg-muted" /></td>
                <td className="px-3 py-3"><div className="h-8 w-16 rounded bg-muted ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
