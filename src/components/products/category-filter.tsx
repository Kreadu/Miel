import Link from "next/link";

import type { Category } from "./types";

const chip = (selected: boolean) =>
  `inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium ${
    selected
      ? "bg-primary text-primary-foreground"
      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
  }`;

/** S19-15/S19-24: "Todos" + un botón por categoría (`?categoria=<id>`), en Catálogo y Productos. */
export function CategoryFilter({
  categories,
  current,
  basePath,
  allLabel,
}: {
  categories: Category[];
  current?: string;
  basePath: string;
  allLabel: string;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={basePath} className={chip(!current)}>
        {allLabel}
      </Link>
      {categories.map((c) => (
        <Link key={c.id} href={`${basePath}?categoria=${c.id}`} className={chip(current === c.id)}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
