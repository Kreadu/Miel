"use client";

import { toggleProductActive } from "@/actions/products";
import { Button } from "@/components/ui/button";

export function ArchiveProductAction({ id, active }: { id: string; active: boolean }) {
  const confirmMessage = active
    ? "¿Archivar este producto? Dejará de aparecer como disponible."
    : "¿Reactivar este producto?";

  return (
    <form
      action={toggleProductActive}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Button type="submit" variant="ghost" size="sm">
        {active ? "Archivar" : "Reactivar"}
      </Button>
    </form>
  );
}
