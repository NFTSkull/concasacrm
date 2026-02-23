"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSessionRepo } from "@/domain/session";
import { usePrecalificacionesRepo } from "@/domain/precalificaciones";
import { Button } from "@/components/ui/Button";
import { FiltersBar } from "@/components/FiltersBar";
import type { Precalificacion } from "@/domain/precalificaciones";
import {
  applyFilters,
  formatDateTimeMx,
  DEFAULT_FILTERS,
  type FiltersState,
} from "@/lib/filters";

const MAX_NOTAS_LEN = 70;

function truncateNotas(s: string | undefined): string {
  const t = (s ?? "").trim();
  if (t.length <= MAX_NOTAS_LEN) return t || "—";
  return t.slice(0, MAX_NOTAS_LEN) + "…";
}

function DecisionBadge({ decision }: { decision?: string }) {
  const d = decision ?? "pendiente";
  const styles =
    d === "aprobado"
      ? "bg-green-100 text-green-800"
      : d === "no_cumple"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  const label =
    d === "aprobado"
      ? "Aprobado"
      : d === "no_cumple"
        ? "No cumple"
        : "Pendiente";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

export default function AsesorDashboardPage() {
  const { sessionRepo, currentUser } = useSessionRepo();
  const repo = usePrecalificacionesRepo();
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [list, setList] = useState<Precalificacion[]>([]);
  const fullList = useMemo(
    () => (currentUser ? list : []),
    [currentUser, list]
  );

  useEffect(() => {
    if (!currentUser) return;
    repo
      .listForUser({ email: currentUser.email, role: currentUser.role })
      .then(setList);
  }, [currentUser, repo]);

  const filteredList = useMemo(
    () => applyFilters(fullList, filters),
    [fullList, filters]
  );

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
          No has iniciado sesión como asesor.{" "}
          <Link href="/login" className="text-blue-600 underline">
            Ir a login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            ConCasa CRM · Asesor
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{currentUser.email}</span>
            <Button variant="outline" onClick={() => sessionRepo.logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-medium text-gray-900">
            Mis precalificaciones
          </h2>
          <Link href="/asesor/nueva">
            <Button variant="primary">Nueva precalificación</Button>
          </Link>
        </div>

        <FiltersBar
          filters={filters}
          setFilters={setFilters}
          asesorOptions={[]}
          showAsesorFilter={false}
          showProgramaFilter={false}
        />

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Creada
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Programa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  NSS
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Decisión
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Notas
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Monto aprobado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredList.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No hay precalificaciones. Crea una nueva.
                  </td>
                </tr>
              ) : (
                filteredList.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                      {formatDateTimeMx(p.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {p.programa}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {p.nss}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {p.cliente_nombre ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {p.telefono_cliente ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <DecisionBadge decision={p.decision} />
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600">
                      {truncateNotas(p.notas_revision)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {p.decision === "no_cumple"
                        ? "—"
                        : p.monto_aprobado != null
                          ? `$${p.monto_aprobado.toLocaleString()}`
                          : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
