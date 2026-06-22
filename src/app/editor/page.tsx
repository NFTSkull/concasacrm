"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessionRepo } from "@/domain/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDateTimeMx } from "@/lib/filters";
import {
  ExpedientesSupabaseError,
  useExpedientesRepo,
  type EditorDecision,
  type ExpedienteMock,
} from "@/domain/expedientes";
import { isDataModeSupabase } from "@/lib/dataMode";

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

type EditorRowDraft = {
  montoStr: string;
  notas: string;
};

function mapExpedienteToEditorRow(e: ExpedienteMock): EditorPrecalRow {
  return {
    id: e.id,
    programa: e.base.programa,
    cliente_nombre: e.base.cliente_nombre,
    telefono_cliente: e.base.telefono_cliente,
    asesorId: e.base.asesorId,
    createdAt: e.base.createdAt,
    decision: e.editorDecision.decision,
    monto_aprobado: e.editorDecision.monto_aprobado,
    notas_revision: e.editorDecision.notas_revision,
  };
}

function computeDecision(montoStr: string, notasStr: string): EditorDecision {
  const montoTrim = (montoStr ?? "").trim();
  const notasTrim = (notasStr ?? "").trim();
  const num = montoTrim === "" ? null : Number(montoTrim);
  const hasMonto = num !== null && !Number.isNaN(num) && num >= 0;
  if (hasMonto) return "aprobado";
  if (notasTrim.length > 0) return "no_cumple";
  return "pendiente";
}

function parseMonto(montoStr: string): number | null {
  const trimmed = montoStr.trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
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
  const repo = useExpedientesRepo();
  const dataSupabase = isDataModeSupabase();
  const [rows, setRows] = useState<EditorPrecalRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EditorRowDraft>>({});
  const [buscar, setBuscar] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    void (async () => {
      try {
        const list = await repo.listForEditor();
        const combined = list
          .map(mapExpedienteToEditorRow)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        setRows(combined);
        if (dataSupabase) {
          setDrafts({});
        }
      } catch (err) {
        console.error(
          "[editor] error leyendo expedientes:",
          err instanceof Error ? err.message : String(err),
        );
        setRows([]);
      }
    })();
  }, [dataSupabase, repo]);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser, loadData]);

  useEffect(() => {
    if (!currentUser || dataSupabase) return;
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
  }, [currentUser, dataSupabase, loadData]);

  const persistDecisionMock = (
    expedienteId: string,
    payload: {
      decision: EditorDecision;
      monto_aprobado: number | null;
      notas_revision: string;
    },
  ) => {
    setGlobalError(null);
    void repo
      .upsertEditorDecision(expedienteId, payload)
      .catch((err) => {
        const msg =
          err instanceof ExpedientesSupabaseError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Error al guardar la decisión.";
        setGlobalError(msg);
      });
  };

  const getRowDraft = useCallback(
    (row: EditorPrecalRow): EditorRowDraft => {
      const draft = drafts[row.id];
      if (draft) return draft;
      return {
        montoStr:
          row.monto_aprobado != null ? String(row.monto_aprobado) : "",
        notas: row.notas_revision,
      };
    },
    [drafts],
  );

  const updateRowDraft = (row: EditorPrecalRow, patch: Partial<EditorRowDraft>) => {
    setDrafts((prevDrafts) => ({
      ...prevDrafts,
      [row.id]: {
        montoStr:
          patch.montoStr ??
          prevDrafts[row.id]?.montoStr ??
          (row.monto_aprobado != null ? String(row.monto_aprobado) : ""),
        notas:
          patch.notas ??
          prevDrafts[row.id]?.notas ??
          row.notas_revision,
      },
    }));
  };

  const saveSupabaseDecision = async (
    expedienteId: string,
    payload: {
      decision: EditorDecision;
      monto_aprobado: number | null;
      notas_revision: string;
    },
  ) => {
    setSavingId(expedienteId);
    setGlobalError(null);
    try {
      const updated = await repo.upsertEditorDecision(expedienteId, payload);
      const nextRow = mapExpedienteToEditorRow(updated);
      setRows((prev) =>
        prev.map((row) => (row.id === expedienteId ? nextRow : row)),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[expedienteId];
        return next;
      });
    } catch (err) {
      const msg =
        err instanceof ExpedientesSupabaseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al guardar la decisión.";
      setGlobalError(msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleSupabaseSave = async (
    row: EditorPrecalRow,
    decision: EditorDecision,
  ) => {
    const draft = getRowDraft(row);
    const monto = parseMonto(draft.montoStr);
    if (monto !== null && monto < 0) {
      setGlobalError("El monto aprobado no puede ser negativo.");
      return;
    }
    if (decision === "aprobado" && (monto === null || monto <= 0)) {
      setGlobalError("El monto aprobado debe ser mayor a cero para aprobar.");
      return;
    }
    await saveSupabaseDecision(row.id, {
      decision,
      monto_aprobado: decision === "aprobado" ? monto : null,
      notas_revision: draft.notas.trim(),
    });
  };

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

        {dataSupabase ? (
          <p className="text-xs text-gray-500">
            Edita monto y notas localmente; guarda con los botones de acción (no
            se envía a Supabase por cada tecla).
          </p>
        ) : null}

        {globalError ? (
          <p role="alert" className="text-xs text-red-600">
            {globalError}
          </p>
        ) : null}

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
                {dataSupabase ? (
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Acciones
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={dataSupabase ? 10 : 9}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No hay expedientes para revisar.
                    {!dataSupabase ? " (modo mock)" : ""}
                  </td>
                </tr>
              ) : (
                filteredRows.map((p) => {
                  const draft = dataSupabase ? getRowDraft(p) : null;
                  const montoValue = dataSupabase
                    ? draft!.montoStr
                    : p.monto_aprobado != null
                      ? String(p.monto_aprobado)
                      : "";
                  const notasValue = dataSupabase
                    ? draft!.notas
                    : p.notas_revision;
                  const rowSaving = savingId === p.id;

                  return (
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
                          value={montoValue}
                          disabled={dataSupabase && rowSaving}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (dataSupabase) {
                              updateRowDraft(p, { montoStr: val });
                              return;
                            }
                            try {
                              const nextMonto =
                                val.trim() === "" ? null : Number(val);
                              const nextDecision = computeDecision(
                                val,
                                p.notas_revision,
                              );
                              if (nextMonto !== null && nextMonto < 0) {
                                throw new Error(
                                  "El monto aprobado no puede ser negativo.",
                                );
                              }
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
                              persistDecisionMock(p.id, {
                                decision: nextDecision,
                                monto_aprobado: nextMonto,
                                notas_revision: p.notas_revision,
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
                          value={notasValue}
                          disabled={dataSupabase && rowSaving}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (dataSupabase) {
                              updateRowDraft(p, { notas: val });
                              return;
                            }
                            const montoStr =
                              p.monto_aprobado != null
                                ? String(p.monto_aprobado)
                                : "";
                            const nextDecision = computeDecision(
                              montoStr,
                              val,
                            );
                            setRows((prev) =>
                              prev.map((row) =>
                                row.id === p.id
                                  ? {
                                      ...row,
                                      notas_revision: val,
                                      decision: nextDecision,
                                    }
                                  : row,
                              ),
                            );
                            persistDecisionMock(p.id, {
                              decision: nextDecision,
                              monto_aprobado: p.monto_aprobado,
                              notas_revision: val.trim(),
                            });
                          }}
                          placeholder="Notas de revisión..."
                        />
                      </td>
                      {dataSupabase ? (
                        <td className="px-3 py-2">
                          <div className="flex min-w-[9rem] flex-col gap-1">
                            <Button
                              type="button"
                              variant="primary"
                              className="text-xs py-1"
                              disabled={rowSaving}
                              onClick={() =>
                                void handleSupabaseSave(p, "aprobado")
                              }
                            >
                              {rowSaving ? "Guardando…" : "Aprobar"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="text-xs py-1"
                              disabled={rowSaving}
                              onClick={() =>
                                void handleSupabaseSave(p, "no_cumple")
                              }
                            >
                              No cumple
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="text-xs py-1"
                              disabled={rowSaving}
                              onClick={() =>
                                void handleSupabaseSave(p, "pendiente")
                              }
                            >
                              Pendiente
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
