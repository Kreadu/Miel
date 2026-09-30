"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { quickCreateWorkerPosition } from "@/actions/workers";
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

// Mismo sentinel que lee src/actions/workers.ts (Radix no admite value="").
const NONE = "__none__";

type Position = { id: string; name: string };

/** S21-02c: cargo del trabajador + "+" para crearlo sin salir de la ficha (modal sin <form>). */
export function PositionPicker({
  id,
  positions,
  defaultValue,
}: {
  id: string;
  positions: Position[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue || NONE);
  const [created, setCreated] = useState<Position[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = [...positions, ...created.filter((c) => !positions.some((p) => p.id === c.id))];

  function handleCreate() {
    startTransition(async () => {
      const result = await quickCreateWorkerPosition(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated((prev) => [...prev, result.position]);
      setValue(result.position.id);
      setName("");
      setError(null);
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Cargo</Label>
      <div className="flex items-center gap-2">
        <Select name="position_id" value={value} onValueChange={setValue}>
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin cargo</SelectItem>
            {options.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Crear cargo">
              <Plus className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo cargo</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-new`}>Nombre del cargo</Label>
                <Input
                  id={`${id}-new`}
                  placeholder="Ej. Cajero"
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
                {pending ? "Creando…" : "Crear cargo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
