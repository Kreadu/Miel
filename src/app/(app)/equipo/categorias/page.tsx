import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CategoryForm } from "./category-form";
import { CategoryRow } from "./category-row";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.categories");
  return { title: `${t("title")} · Miel` };
}

/** S21-02: categorías de trabajador — cada una define qué módulos ve quien la tenga. */
export default async function CategoriasTrabajadorPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const t = await getTranslations("rrhh.categories");
  const [{ data: categories }, { data: workers }] = await Promise.all([
    supabase.from("worker_categories").select("id, name, modules").order("name"),
    supabase.from("workers").select("category_id").eq("active", true),
  ]);
  const countByCategory = new Map<string, number>();
  for (const w of workers ?? []) {
    if (w.category_id) countByCategory.set(w.category_id, (countByCategory.get(w.category_id) ?? 0) + 1);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <CategoryForm />

      {categories && categories.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              id={c.id}
              name={c.name}
              modules={c.modules}
              workerCount={countByCategory.get(c.id) ?? 0}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </div>
  );
}
