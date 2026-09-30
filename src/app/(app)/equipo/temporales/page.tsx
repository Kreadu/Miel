import { WorkersView } from "../trabajadores/workers-view";

export const metadata = { title: "Temporales y por horas · Miel" };

/** S21-02c: área aparte para trabajadores temporales (con fecha de término) o por horas. */
export default function TemporalesPage() {
  return <WorkersView area="temporales" title="Temporales y por horas" />;
}
