"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { toggleCustomerActive, updateCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";

import { CustomerForm, type CustomerFormValues } from "./customer-form";

export function CustomerRow({
  customer,
  canManage,
}: {
  customer: CustomerFormValues;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="p-2">
          <CustomerForm
            action={updateCustomer}
            values={customer}
            submitLabel="Guardar"
            pendingLabel="Guardando…"
            onCancel={() => setEditing(false)}
            onSuccess={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  const docDisplay = customer.doc_number
    ? `${customer.doc_type.toUpperCase()} ${customer.doc_number}`
    : "—";

  return (
    <tr className="border-b border-border text-sm last:border-0">
      <td
        className={`px-3 py-2.5 ${customer.active ? "" : "text-muted-foreground line-through"}`}
      >
        {customer.name}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{docDisplay}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{customer.email || "—"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{customer.phone || "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/ventas/clientes/${customer.id}`}
            className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            CRM
          </Link>
          {canManage ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <form action={toggleCustomerActive}>
                <input type="hidden" name="id" value={customer.id} />
                <input type="hidden" name="active" value={(!customer.active).toString()} />
                <Button type="submit" variant="ghost" size="sm">
                  {customer.active ? "Archivar" : "Reactivar"}
                </Button>
              </form>
            </>
          ) : (
            !customer.active && (
              <span className="block text-right text-xs text-muted-foreground ml-2">Archivado</span>
            )
          )}
        </div>
      </td>
    </tr>
  );
}
