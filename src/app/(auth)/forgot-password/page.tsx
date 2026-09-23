import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Recuperar contraseña · Miel" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace para fijar una contraseña nueva.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error === "link-invalido" ? (
          <p role="alert" className="text-sm text-destructive">
            El enlace es inválido, expiró o ya fue usado. Solicita uno nuevo.
          </p>
        ) : null}
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
