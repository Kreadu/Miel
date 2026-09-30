import { WorkersView } from "./workers-view";

export const metadata = { title: "Trabajadores · Miel" };

/** S21-02: trabajadores de planta. Los temporales y por horas están en /equipo/temporales. */
export default function TrabajadoresPage() {
  return <WorkersView area="planta" title="Trabajadores" />;
}
