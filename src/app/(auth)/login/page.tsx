import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión · Miel" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Entra con tu correo y contraseña.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm next={next} />
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Crear cuenta
          </Link>
        </div>
        {/* S21-03: los trabajadores no entran aquí, sino en el equipo de la tienda. */}
        <p className="text-xs text-muted-foreground">
          ¿Eres trabajador? Entra en el computador de la tienda con tu usuario y código de 4 dígitos.
        </p>
      </CardContent>
    </Card>
  );
}
