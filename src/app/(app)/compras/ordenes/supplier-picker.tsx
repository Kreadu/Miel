"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { quickCreateSupplier } from "@/actions/suppliers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Supplier = { id: string; name: string };

/**
 * S19-37: proveedor de la orden + "+" para crear uno sin salir (modal sin <form>: vive dentro
 * del form de la orden). El creado queda elegido; la lista del servidor llega con el refresh.
 */
export function SupplierPicker({
  suppliers,
  value,
  onChange,
}: {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [created, setCreated] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nit, setNit] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations();

  const options = [...suppliers, ...created.filter((c) => !suppliers.some((s) => s.id === c.id))];

  function handleCreate() {
    startTransition(async () => {
      const result = await quickCreateSupplier({ name, nit, phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated((prev) => [...prev, result.supplier]);
      onChange(result.supplier.id);
      setName("");
      setNit("");
      setPhone("");
      setError(null);
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="supplier_id">{t("purchases.supplier")}</Label>
      <div className="flex items-center gap-2">
        <Select name="supplier_id" required value={value} onValueChange={onChange}>
          <SelectTrigger id="supplier_id" className="w-full min-w-0">
            <SelectValue placeholder={t("purchases.picker.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label={t("purchases.picker.create")}>
              <Plus className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("purchases.picker.new")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="quick-supplier-name">{t("purchases.picker.name")}</Label>
                <Input
                  id="quick-supplier-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quick-supplier-nit">{t("purchases.picker.nit")}</Label>
                  <Input id="quick-supplier-nit" value={nit} onChange={(e) => setNit(e.target.value)} maxLength={30} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quick-supplier-phone">{t("purchases.picker.phone")}</Label>
                  <Input
                    id="quick-supplier-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={30}
                  />
                </div>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {t(error)}
                </p>
              ) : null}
              <Button type="button" onClick={handleCreate} disabled={pending || !name.trim()}>
                {pending ? t("purchases.picker.creating") : t("purchases.picker.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
