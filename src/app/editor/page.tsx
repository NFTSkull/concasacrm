"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSessionRepo } from "@/domain/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDateTimeMx } from "@/lib/filters";
import { MockExpedientesRepo, type EditorDecision, type ExpedienteMock } from "@/domain/expedientes/mock.repo";

interface EditorPrecalRow {
  id: string;
  programa: string;
  cliente_nombre: string;
  telefono_cliente: string;
  asesorId: string;
  createdAt: string;
  decision: string;
  monto_aprobado: number | null;
  notas_revision: string;
}

function computeDecision(montoStr: string, notasStr: string): string {
  const montoTrim = (montoStr ?? "").trim();
  const notasTrim = (notasStr ?? "").trim();
  const num = montoTrim === "" ? null : Number(montoTrim);
  const hasMonto = num !== null && !Number.isNaN(num) && num >= 0;
  if (hasMonto) return "aprobado";
  if (notasTrim.length > 0) return "no_cumple";
  return "pendiente";
}

function DecisionBadge({ decision }: { decision?: string }) {
  const d = decision ?? "pendiente";
  let styles = "bg-gray-100 text-gray-700";
  if (d === "aprobado") {
    styles = "bg-green-100 text-green-800";
  } else if (d === "no_cumple") {
    styles = "bg-red-100 text-red-800";
  } else if (d === "pendiente") {
    styles = "bg-amber-100 text-amber-800";
  }
  const label =
    d === "aprobado"
      ? "Aprobado"
      : d === "no_cumple"
        ? "No cumple"
        : "Pendiente";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

export default function EditorDashboardPage() {
  const { sessionRepo, currentUser } = useSessionRepo();
  const repo = useMemo(() => new MockExpedientesRepo(), []);
  const [rows, setRows] = useState<EditorPrecalRow[]>([]);
  const [buscar, setBuscar] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadData = () => {
    void (async () => {
      try {
        const list = await repo.listForEditor();
        const combined: EditorPrecalRow[] = list
          .map((e: ExpedienteMock) => ({
            id: e.id,
            programa: e.base.programa,
            cliente_nombre: e.base.cliente_nombre,
            telefono_cliente: e.base.telefono_cliente,
            asesorId: e.base.asesorId,
            createdAt: e.base.createdAt,
            decision: e.editorDecision.decision,
            monto_aprobado: e.editorDecision.monto_aprobado,
            notas_revision: e.editorDecision.notas_revision,
          }))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        setRows(combined);
      } catch (err) {
        console.error(
          "[editor] error leyendo datos mock unificados:",
          err instanceof Error ? err.message : String(err),
        );
        setRows([]);
      }
    })();
  };

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (
        e.key === "precalificaciones_mock" ||
        e.key === "decisions_mock"
      ) {
        loadData();
      }
    };
    const customHandler = () => {
      loadData();
    };
    window.addEventListener("storage", handler);
    window.addEventListener("decisions_mock_updated", customHandler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("decisions_mock_updated", customHandler);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      return (
        p.cliente_nombre.toLowerCase().includes(q) ||
        p.telefono_cliente.includes(q) ||
        p.programa.toLowerCase().includes(q) ||
        (p.asesorId ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, buscar]);

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "editor") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          No has iniciado sesión como editor.{" "}
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
            ConCasa CRM · Editor
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="min-w-0 max-w-xs truncate text-sm text-gray-500">
              {currentUser.email}
            </span>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await sessionRepo.logout();
                } catch (err) {
                  console.error(
                    "[logout] editor:",
                    err instanceof Error ? err.message : String(err),
                  );
                }
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
              }}
              className="min-h-[36px] touch-manipulation sm:min-h-0"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 sm:space-y-6 sm:py-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-gray-900 sm:text-lg">
            Precalificaciones para revisión
          </h2>
          <div className="w-full max-w-xs sm:w-72">
            <Input
              type="search"
              placeholder="Buscar (cliente, teléfono, programa, asesor)"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </div>
        </section>

        {globalError && (
          <p className="text-xs text-red-600">
            {globalError}
          </p>
        )}

        <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Creada
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Cliente
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Teléfono
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Programa
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Asesor
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Decisión
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Monto aprobado
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No hay precalificaciones mock para revisar.
                  </td>
                </tr>
              ) : (
                filteredRows.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                      {formatDateTimeMx(p.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                      {p.cliente_nombre || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                      {p.telefono_cliente || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                      {p.programa}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                      {p.asesorId || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <DecisionBadge decision={p.decision} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="no-spinner w-32 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={
                          p.monto_aprobado != null ? String(p.monto_aprobado) : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          try {
                            const nextMonto =
                              val.trim() === "" ? null : Number(val);
                            const nextDecision = computeDecision(
                              val,
                              p.notas_revision,
                            ) as EditorDecision;
                            if (nextMonto !== null && nextMonto < 0) {
                              throw new Error(
                                "El monto aprobado no puede ser negativo."
                              );
                            }

                            // Actualizamos la UI de forma sincronizada.
                            setRows((prev) =>
                              prev.map((row) =>
                                row.id === p.id
                                  ? {
                                      ...row,
                                      monto_aprobado: nextMonto,
                                      decision: nextDecision,
                                    }
                                  : row,
                              ),
                            );

                            setGlobalError(null);
                            void repo
                              .updateDecision(p.id, {
                                decision: nextDecision,
                                monto_aprobado: nextMonto,
                                notas_revision: p.notas_revision,
                              })
                              .catch((err) => {
                                const msg =
                                  err instanceof Error
                                    ? err.message
                                    : "Error al guardar la decisión.";
                                setGlobalError(msg);
                              });
                          } catch (err) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : "Error al guardar la decisión.";
                            setGlobalError(msg);
                          }
                        }}
                      />
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-xs text-gray-600">
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={2}
                        value={p.notas_revision}
                        onChange={(e) => {
                          const val = e.target.value;
                          try {
                            const montoStr =
                              p.monto_aprobado != null
                                ? String(p.monto_aprobado)
                                : "";
                            const nextDecision = computeDecision(montoStr, val) as EditorDecision;

                            // Actualizamos la UI.
                            setRows((prev) =>
                              prev.map((row) =>
                                row.id === p.id
                                  ? { ...row, notas_revision: val, decision: nextDecision }
                                  : row,
                              ),
                            );

                            setGlobalError(null);
                            void repo
                              .updateDecision(p.id, {
                                decision: nextDecision,
                                monto_aprobado: p.monto_aprobado,
                                notas_revision: val.trim(),
                              })
                              .catch((err) => {
                                const msg =
                                  err instanceof Error
                                    ? err.message
                                    : "Error al guardar la decisión.";
                                setGlobalError(msg);
                              });
                          } catch (err) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : "Error al guardar la decisión.";
                            setGlobalError(msg);
                          }
                        }}
                        placeholder="Notas de revisión..."
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

