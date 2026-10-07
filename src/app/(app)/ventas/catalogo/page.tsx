import { redirect } from "next/navigation";

/** S19-41: el Catálogo vive en Vender; esta ruta vieja redirige conservando la categoría. */
export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  redirect(categoria ? `/ventas?categoria=${encodeURIComponent(categoria)}` : "/ventas");
}
