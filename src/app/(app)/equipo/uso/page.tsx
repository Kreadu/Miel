import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { historyFilters, todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.usage");
  return { title: `${t("title")} · Miel` };
}

// Radix no admite value="" en un <Select>; "all" no es uuid y se lee como "todos".
const ALL = "all";

/**
 * S21-04: control de uso — ingresos con código (y los intentos fallidos) y acciones importantes,
 * con quién las hizo. Filtros por fechas (hora de Bogotá) y trabajador; solo owner/admin.
 */
export default async function UsoPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; trabajador?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const params = await searchParams;
  const t = await getTranslations("rrhh");
  const { from, to, warehouseId: workerId } = historyFilters(
    { desde: params.desde, hasta: params.hasta, bodega: params.trabajador },
    todayInBogota(),
  );
  const start = `${from}T00:00:00-05:00`;
  const end = `${to}T23:59:59.999-05:00`;

  const supabase = await createClient();
  const { data: workers } = await supabase.from("workers").select("id, full_name, username").order("full_name");
  const worker = workers?.find((w) => w.id === workerId);

  let logins = supabase
    .from("worker_login_attempts")
    .select("id, username, success, attempted_at, workers(full_name)")
    .gte("attempted_at", start)
    .lte("attempted_at", end)
    .order("attempted_at", { ascending: false })
    .limit(200);
  if (worker) logins = logins.eq("username", worker.username ?? "—");
  let actions = supabase
    .from("activity_log")
    .select("id, action, detail, created_at, workers(full_name)")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .limit(200);
  if (worker) actions = actions.eq("worker_id", worker.id);
  const [{ data: loginRows }, { data: actionRows }] = await Promise.all([logins, actions]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("usage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("usage.subtitle")}
        </p>
      </div>

      <form method="get" className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">{t("common.from")}</Label>
          <Input id="desde" name="desde" type="date" defaultValue={from} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">{t("common.to")}</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={to} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="trabajador">{t("common.worker")}</Label>
          <Select name="trabajador" defaultValue={worker?.id ?? ALL}>
            <SelectTrigger id="trabajador" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("common.all")}</SelectItem>
              {(workers ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">{t("common.view")}</Button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t("usage.logins")}</h2>
        {loginRows && loginRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("usage.dateTime")}</th>
                  <th className="px-3 py-2 font-medium">{t("usage.username")}</th>
                  <th className="px-3 py-2 font-medium">{t("common.worker")}</th>
                  <th className="px-3 py-2 font-medium">{t("usage.result")}</th>
                </tr>
              </thead>
              <tbody>
                {loginRows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 tabular-nums">{formatDateTime(r.attempted_at)}</td>
                    <td className="px-3 py-2.5">{r.username}</td>
                    <td className="px-3 py-2.5">{r.workers?.full_name ?? "—"}</td>
                    <td className={`px-3 py-2.5 ${r.success ? "" : "font-medium text-destructive"}`}>
                      {r.success ? t("usage.success") : t("usage.wrongCode")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("usage.noLogins")}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t("usage.actions")}</h2>
        {actionRows && actionRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("usage.dateTime")}</th>
                  <th className="px-3 py-2 font-medium">{t("usage.who")}</th>
                  <th className="px-3 py-2 font-medium">{t("usage.action")}</th>
                  <th className="px-3 py-2 font-medium">{t("usage.detail")}</th>
                </tr>
              </thead>
              <tbody>
                {actionRows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 tabular-nums">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5">{r.workers?.full_name ?? t("usage.account")}</td>
                    <td className="px-3 py-2.5">{t.has(`activity.${r.action}`) ? t(`activity.${r.action}`) : r.action}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("usage.noActions")}
          </p>
        )}
      </section>
    </div>
  );
}
