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
      <header className="border-b border-gray-200 bg-white px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/asesor"
            className="min-h-[44px] flex items-center text-sm text-gray-500 hover:text-gray-700 touch-manipulation sm:min-h-0"
          >
            ← Volver al dashboard
          </Link>
          <h1 className="text-base font-semibold text-gray-900 sm:text-lg">
            ConCasa CRM · Nueva precalificación
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-3 py-6 sm:px-4 sm:py-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="mb-4 text-lg font-medium text-gray-900 sm:mb-6">
            Datos de precalificación
          </h2>
          <div className="flex flex-col gap-4">
            <Select
              name="programa"
              label="Programa"
              options={PROGRAMAS.map((p) => ({ value: p, label: p }))}
              required
              className="min-h-[44px] sm:min-h-0"
            />
            <Input
              name="cliente_nombre"
              label="Nombre del cliente"
              placeholder="Nombre completo"
              required
              className="min-h-[44px] sm:min-h-0"
            />
            <Input
              name="telefono_cliente"
              label="Teléfono del cliente"
              placeholder="10 dígitos (México)"
              required
              maxLength={14}
              inputMode="numeric"
              className="min-h-[44px] sm:min-h-0"
            />
            <Input
              name="nss"
              label="IMSS / NSS"
              placeholder="11 dígitos"
              required
              maxLength={11}
              inputMode="numeric"
              className="min-h-[44px] sm:min-h-0"
            />
            <Input
              name="direccion_opcional"
              label="Dirección (opcional)"
              placeholder="Calle, número, colonia..."
              className="min-h-[44px] sm:min-h-0"
            />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              variant="primary"
              className="min-h-[44px] w-full touch-manipulation sm:min-h-0 sm:w-auto"
            >
              Enviar
            </Button>
            <Link href="/asesor" className="w-full sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] w-full touch-manipulation sm:min-h-0 sm:w-auto"
              >
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
