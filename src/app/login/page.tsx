"use client";

import { useRouter } from "next/navigation";
import { useSessionRepo } from "@/domain/session";
import type { Rol } from "@/domain/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function LoginPage() {
  const router = useRouter();
  const { sessionRepo } = useSessionRepo();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const role = (form.elements.namedItem("rol") as HTMLSelectElement)
      .value as Rol;

    (window as unknown as { __CONCASA_PASSWORD?: string }).__CONCASA_PASSWORD =
      password;
    const session = await sessionRepo.login(email, role);

    if (session.role === "asesor") router.push("/asesor");
    else if (session.role === "revisor") router.push("/revisor");
    else router.push("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          ConCasa CRM
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Inicia sesión con tu cuenta
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            name="email"
            type="email"
            label="Email"
            placeholder="tu@email.com"
            required
          />
          <Input
            name="password"
            type="password"
            label="Contraseña"
            placeholder="••••••••"
            required
          />
          <Select
            name="rol"
            label="Rol"
            options={[
              { value: "asesor", label: "Asesor" },
              { value: "revisor", label: "Revisor" },
              { value: "super_admin", label: "Super Admin" },
            ]}
          />
          <Button type="submit" variant="primary" className="mt-2 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
