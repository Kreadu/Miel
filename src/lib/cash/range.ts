const isDate = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** S18-12: la Caja muestra lo de hoy; con fechas, el rango (ordenado si vienen al revés). */
export function cashRange(params: { desde?: string; hasta?: string }, today: string): { from: string; to: string } {
  let from = isDate(params.desde) ? params.desde : today;
  let to = isDate(params.hasta) ? params.hasta : today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
