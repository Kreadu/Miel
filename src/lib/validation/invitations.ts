import { z } from "zod";

const uuid = z.uuid();

/**
 * S21-03: una sola noción de permisos. "Acceso" = Administrador, Cuenta de la tienda (operativo
 * sin categoría, la que usa el modo tienda) o una categoría de trabajador (su uuid).
 */
export const invitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "auth.errors.emailInvalid" })),
    access: z.string().refine((v) => v === "admin" || v === "tienda" || uuid.safeParse(v).success, {
      error: "invitations.errors.accessRequired",
    }),
    worker_id: uuid.optional(),
  })
  .transform(({ email, access, worker_id }) => ({
    email,
    role: access === "admin" ? ("admin" as const) : ("member" as const),
    category_id: access === "admin" || access === "tienda" ? null : access,
    worker_id: worker_id ?? null,
  }));
