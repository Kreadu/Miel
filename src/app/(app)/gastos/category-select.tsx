"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { quickCreateExpenseCategory } from "@/actions/expenses";
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

/**
 * S22-01: categoría del gasto (ya clasificada como fija o variable) + "+" para crear una propia
 * con el tipo de la hoja. Modal sin <form>: vive dentro del form del gasto.
 */
export function CategorySelect({
  id,
  kind,
  categories,
  defaultValue,
}: {
  id: string;
  kind: "fixed" | "variable";
  categories: string[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [created, setCreated] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Un gasto viejo con categoría escrita a mano (fuera de la lista) sigue mostrándose.
  const options = [...new Set([...categories, ...created, ...(defaultValue ? [defaultValue] : [])])];

  function handleCreate() {
    startTransition(async () => {
      const result = await quickCreateExpenseCategory({ name, kind });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated((prev) => [...prev, result.name]);
      setValue(result.name);
      setName("");
      setError(null);
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Categoría</Label>
      <div className="flex items-center gap-2">
        <Select name="category" value={value} onValueChange={setValue} required>
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectValue placeholder="Elige la categoría" />
          </SelectTrigger>
          <SelectContent>
            {options.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Crear categoría">
              <Plus className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva categoría de gasto {kind === "fixed" ? "fijo" : "variable"}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-new`}>Nombre</Label>
                <Input
                  id={`${id}-new`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  maxLength={80}
                  autoFocus
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="button" onClick={handleCreate} disabled={pending || !name.trim()}>
                {pending ? "Creando…" : "Crear categoría"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
