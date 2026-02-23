"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionRepo } from "@/domain/session";
import { usePrecalificacionesRepo } from "@/domain/precalificaciones";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PROGRAMAS } from "@/lib/mock-store";

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export default function NuevaPrecalificacionPage() {
  const router = useRouter();
  const { currentUser } = useSessionRepo();
  const repo = usePrecalificacionesRepo();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const programa = (form.elements.namedItem("programa") as HTMLSelectElement)
      .value as "Mejoravit" | "Subcuenta" | "Compro tu casa";
    const cliente_nombre = (
      form.elements.namedItem("cliente_nombre") as HTMLInputElement
    ).value.trim();
    const telefonoRaw = (
      form.elements.namedItem("telefono_cliente") as HTMLInputElement
    ).value;
    const telefono_cliente = onlyDigits(telefonoRaw);
    const nss = (form.elements.namedItem("nss") as HTMLInputElement).value.trim();
    const direccion_opcional = (
      form.elements.namedItem("direccion_opcional") as HTMLInputElement
    ).value.trim();

    try {
      await repo.create({
        programa,
        nss,
        cliente_nombre,
        telefono_cliente,
        direccion_opcional,
      });
      router.push("/asesor");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear la precalificación.");
    }
  }

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }
  if (!currentUser || currentUser.role !== "asesor") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          <Link href="/login" className="text-blue-600 underline">
            Inicia sesión como asesor
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/asesor"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver al dashboard
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            ConCasa CRM · Nueva precalificación
          </h1>
          <span />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-6 text-lg font-medium text-gray-900">
            Datos de precalificación
          </h2>
          <div className="flex flex-col gap-4">
            <Select
              name="programa"
              label="Programa"
              options={PROGRAMAS.map((p) => ({ value: p, label: p }))}
              required
            />
            <Input
              name="cliente_nombre"
              label="Nombre del cliente"
              placeholder="Nombre completo"
              required
            />
            <Input
              name="telefono_cliente"
              label="Teléfono del cliente"
              placeholder="10 dígitos (México)"
              required
              maxLength={14}
              inputMode="numeric"
            />
            <Input
              name="nss"
              label="IMSS / NSS"
              placeholder="11 dígitos"
              required
              maxLength={11}
              inputMode="numeric"
            />
            <Input
              name="direccion_opcional"
              label="Dirección (opcional)"
              placeholder="Calle, número, colonia..."
            />
          </div>
          <div className="mt-6 flex gap-3">
            <Button type="submit" variant="primary">
              Enviar
            </Button>
            <Link href="/asesor">
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
