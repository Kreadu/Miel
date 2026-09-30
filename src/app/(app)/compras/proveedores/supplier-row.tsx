"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { toggleSupplierActive, updateSupplier } from "@/actions/suppliers";
import { Button } from "@/components/ui/button";

import { SupplierForm, type SupplierFormValues } from "./supplier-form";

export function SupplierRow({
  supplier,
  canManage,
}: {
  supplier: SupplierFormValues;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const t = useTranslations("suppliers");

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="p-2">
          <SupplierForm
            action={updateSupplier}
            values={supplier}
            submitLabel={t("save")}
            pendingLabel={t("saving")}
            onCancel={() => setEditing(false)}
            onSuccess={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border text-sm last:border-0">
      <td
        className={`px-3 py-2.5 ${supplier.active ? "" : "text-muted-foreground line-through"}`}
      >
        {supplier.name}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{supplier.nit || "—"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{supplier.email || "—"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{supplier.phone || "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/compras/proveedores/${supplier.id}/productos`}>{t("products")}</Link>
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
              <form action={toggleSupplierActive}>
                <input type="hidden" name="id" value={supplier.id} />
                <input type="hidden" name="active" value={(!supplier.active).toString()} />
                <Button type="submit" variant="ghost" size="sm">
                  {supplier.active ? t("archive") : t("reactivate")}
                </Button>
              </form>
            </>
          ) : (
            !supplier.active && (
              <span className="text-xs text-muted-foreground">{t("archived")}</span>
            )
          )}
        </div>
      </td>
    </tr>
  );
}
