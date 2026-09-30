import { redirect } from "next/navigation";

/** S19-37: la hoja de compra vive en /compras; esta ruta vieja redirige conservando los filtros. */
export default async function OrdenesCompraPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = new URLSearchParams(
    Object.entries(await searchParams).filter((e): e is [string, string] => e[1] !== undefined),
  );
  const query = params.toString();
  redirect(query ? `/compras?${query}` : "/compras");
}
