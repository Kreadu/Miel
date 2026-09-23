import { z } from "zod";

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Correo electrónico inválido" })),
  role: z.enum(["admin", "member"]),
});
