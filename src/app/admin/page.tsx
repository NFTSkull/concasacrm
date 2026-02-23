"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSessionRepo } from "@/domain/session";
import { usePrecalificacionesRepo } from "@/domain/precalificaciones";
import type { Precalificacion } from "@/domain/precalificaciones";
import { Button } from "@/components/ui/Button";
import { FiltersBar } from "@/components/FiltersBar";
import {
  applyFilters,
  groupByDay,
  toDayKey,
  formatDateTimeMx,
  formatDateKeyToDisplay,
  DEFAULT_FILTERS,
  type FiltersState,
} from "@/lib/filters";
import { getAsesorDisplayMap, getAsesorDisplayLabel } from "@/lib/asesorDisplay";
import { supabase } from "@/lib/supabaseClient";

function getTodayYMD(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
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
    d === "aprobado" ? "Aprobado" : d === "no_cumple" ? "No cumple" : "Pendiente";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

function AdminTableBody({
  list,
  editHref,
  asesorMap,
}: {
  list: Precalificacion[];
  editHref: (id: string) => string;
  asesorMap: Map<string, string>;
}) {
  return (
    <>
      {list.map((p) => (
        <tr key={p.id} className="hover:bg-gray-50">
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {formatDateTimeMx(p.createdAt)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {getAsesorDisplayLabel(p.asesorId, asesorMap)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
            {p.programa}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.nss}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.cliente_nombre ?? "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.telefono_cliente ?? "—"}
          </td>
          <td className="max-w-[180px] truncate px-3 py-2 text-sm text-gray-600">
            {p.direccion_opcional || "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.monto_aprobado != null
              ? `$${p.monto_aprobado.toLocaleString()}`
              : "—"}
          </td>
          <td className="max-w-[180px] truncate px-3 py-2 text-sm text-gray-600">
            {p.notas || "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2">
            <Link href={editHref(p.id)}>
              <Button variant="outline" className="text-xs">
                Editar
              </Button>
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}

const ADMIN_TABLE_HEAD = (
  <thead className="bg-gray-50">
    <tr>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Creada
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        asesorId
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        programa
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        nss
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Cliente
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Teléfono
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        direccion_opcional
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        monto_aprobado
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        notas
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Acción
      </th>
    </tr>
  </thead>
);

const ADMIN_DAY_TABLE_HEAD = (
  <thead className="bg-gray-50">
    <tr>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Creada
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Programa
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        NSS
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Cliente
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Teléfono
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Asesor
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Decisión
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Monto
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Notas
      </th>
      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
        Acción
      </th>
    </tr>
  </thead>
);

function AdminDayTableBody({
  list,
  editHref,
  asesorMap,
}: {
  list: Precalificacion[];
  editHref: (id: string) => string;
  asesorMap: Map<string, string>;
}) {
  return (
    <>
      {list.map((p) => (
        <tr key={p.id} className="hover:bg-gray-50">
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {formatDateTimeMx(p.createdAt)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
            {p.programa}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.nss}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.cliente_nombre ?? "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.telefono_cliente ?? "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {getAsesorDisplayLabel(p.asesorId, asesorMap)}
          </td>
          <td className="whitespace-nowrap px-3 py-2">
            <DecisionBadge decision={p.decision} />
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
            {p.decision === "no_cumple"
              ? "—"
              : p.monto_aprobado != null
                ? `$${p.monto_aprobado.toLocaleString()}`
                : "—"}
          </td>
          <td className="max-w-[180px] truncate px-3 py-2 text-sm text-gray-600">
            {(p.notas_revision ?? p.notas ?? "").trim() || "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2">
            <Link href={editHref(p.id)}>
              <Button variant="outline" className="text-xs">
                Editar
              </Button>
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function AdminDashboardPage() {
  const { sessionRepo, currentUser } = useSessionRepo();
  const repo = usePrecalificacionesRepo();
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [groupByDate, setGroupByDate] = useState(false);
  const [daySelected, setDaySelected] = useState<string>(getTodayYMD);
  const vistaDiaRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<Precalificacion[]>([]);
  const [asesorMap, setAsesorMap] = useState<Map<string, string>>(new Map());
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const fullList = useMemo(
    () => (currentUser ? list : []),
    [currentUser, list]
  );

  useEffect(() => {
    if (!currentUser) return;
    repo
      .listPageForUser(
        { email: currentUser.email, role: currentUser.role },
        { page, pageSize }
      )
      .then(({ data, count }) => {
        setList(data);
        setTotalCount(count);
        const newTotalPages = Math.ceil(count / pageSize) || 0;
        setPage((p) =>
          newTotalPages > 0 && p > newTotalPages ? newTotalPages : p
        );
      });
  }, [currentUser, repo, page, pageSize]);

  const refreshPage = useCallback(async () => {
    if (!currentUser) return;
    const { data, count } = await repo.listPageForUser(
      { email: currentUser.email, role: currentUser.role },
      { page: pageRef.current, pageSize }
    );
    setList(data);
    setTotalCount(count);
    const newTotalPages = Math.ceil(count / pageSize) || 0;
    setPage((p) =>
      newTotalPages > 0 && p > newTotalPages ? newTotalPages : p
    );
  }, [currentUser, repo, pageSize]);

  useEffect(() => {
    if (!currentUser) return;
    const debounceRef = { timeoutId: null as ReturnType<typeof setTimeout> | null, hasInsert: false };
    const channel = supabase
      .channel("precalificaciones-admin-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "precalificaciones" },
        (payload: { eventType?: string }) => {
          if (debounceRef.timeoutId) clearTimeout(debounceRef.timeoutId);
          if (payload.eventType === "INSERT") debounceRef.hasInsert = true;
          debounceRef.timeoutId = setTimeout(() => {
            if (debounceRef.hasInsert) {
              setPage(1);
            } else {
              refreshPage();
            }
            debounceRef.hasInsert = false;
            debounceRef.timeoutId = null;
          }, 300);
        }
      )
      .subscribe();
    return () => {
      if (debounceRef.timeoutId) clearTimeout(debounceRef.timeoutId);
      supabase.removeChannel(channel);
    };
  }, [currentUser, refreshPage]);

  useEffect(() => {
    getAsesorDisplayMap()
      .then(setAsesorMap)
      .catch(() => setAsesorMap(new Map()));
  }, []);

  const asesorOptions = useMemo(() => {
    const ids = new Set(fullList.map((p) => p.asesorId));
    return Array.from(ids)
      .sort((a, b) => getAsesorDisplayLabel(a, asesorMap).localeCompare(getAsesorDisplayLabel(b, asesorMap)))
      .map((id) => ({ value: id, label: getAsesorDisplayLabel(id, asesorMap) }));
  }, [fullList, asesorMap]);

  const filteredList = useMemo(
    () => applyFilters(fullList, filters),
    [fullList, filters]
  );

  const resumenPorAsesor = useMemo(() => {
    const byAsesor = new Map<
      string,
      { total: number; ultimaCreatedAt: string }
    >();
    for (const p of filteredList) {
      const prev = byAsesor.get(p.asesorId);
      const ultima = !prev
        ? p.createdAt
        : p.createdAt > prev.ultimaCreatedAt
          ? p.createdAt
          : prev.ultimaCreatedAt;
      byAsesor.set(p.asesorId, {
        total: (prev?.total ?? 0) + 1,
        ultimaCreatedAt: ultima,
      });
    }
    return Array.from(byAsesor.entries())
      .map(([asesorId, data]) => ({ asesorId, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [filteredList]);

  const kpiUltimaActividad = useMemo(() => {
    if (filteredList.length === 0) return null;
    const max = filteredList.reduce(
      (acc, p) => (p.createdAt > acc ? p.createdAt : acc),
      filteredList[0].createdAt
    );
    return max;
  }, [filteredList]);

  const top3Asesores = useMemo(
    () => resumenPorAsesor.slice(0, 3),
    [resumenPorAsesor]
  );

  const groupedByDay = useMemo(
    () => groupByDay(filteredList),
    [filteredList]
  );

  const filteredListByDay = useMemo(
    () =>
      filteredList.filter((p) => toDayKey(p.createdAt) === daySelected),
    [filteredList, daySelected]
  );

  const totalPages = Math.ceil(totalCount / pageSize) || 0;
  const canPrevious = page > 1;
  const canNext = page < totalPages;
  const handlePrevious = useCallback(() => {
    if (canPrevious) setPage((p) => p - 1);
  }, [canPrevious]);
  const handleNext = useCallback(() => {
    if (canNext) setPage((p) => p + 1);
  }, [canNext]);

  const dayKpis = useMemo(() => {
    let pendientes = 0;
    let aprobadas = 0;
    let noCumple = 0;
    for (const p of filteredListByDay) {
      const d = p.decision ?? "pendiente";
      if (d === "pendiente") pendientes++;
      else if (d === "aprobado") aprobadas++;
      else noCumple++;
    }
    return {
      total: filteredListByDay.length,
      pendientes,
      aprobadas,
      noCumple,
    };
  }, [filteredListByDay]);

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }
  if (!currentUser || currentUser.role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          No tienes acceso como Super Admin.{" "}
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
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            ConCasa CRM · Super Admin
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{currentUser.email}</span>
            <Button variant="outline" onClick={() => sessionRepo.logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <FiltersBar
          filters={filters}
          setFilters={setFilters}
          asesorOptions={asesorOptions}
          showAsesorFilter
          showProgramaFilter
        />

        {/* Vista del día */}
        <section ref={vistaDiaRef} className="scroll-mt-4">
          <h2 className="mb-4 text-xl font-medium text-gray-900">
            Vista del día
          </h2>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="admin-day-picker"
                className="text-sm font-medium text-gray-700"
              >
                Día
              </label>
              <input
                id="admin-day-picker"
                type="date"
                value={daySelected}
                onChange={(e) => setDaySelected(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-gray-500">
                Total del día
              </div>
              <div className="mt-1 text-xl font-semibold text-gray-900">
                {dayKpis.total}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-gray-500">
                Pendientes
              </div>
              <div className="mt-1 text-xl font-semibold text-amber-700">
                {dayKpis.pendientes}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-gray-500">
                Aprobadas
              </div>
              <div className="mt-1 text-xl font-semibold text-green-700">
                {dayKpis.aprobadas}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-gray-500">
                No cumple
              </div>
              <div className="mt-1 text-xl font-semibold text-red-700">
                {dayKpis.noCumple}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              {ADMIN_DAY_TABLE_HEAD}
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredListByDay.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No hay precalificaciones en este día (con filtros actuales).
                    </td>
                  </tr>
                ) : (
                  <AdminDayTableBody
                    list={filteredListByDay}
                    editHref={(id) => `/admin/${id}`}
                    asesorMap={asesorMap}
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase text-gray-500">
              Total precalificaciones
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {filteredList.length}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase text-gray-500">
              Última actividad
            </div>
            <div className="mt-1 text-lg text-gray-900">
              {kpiUltimaActividad
                ? formatDateTimeMx(kpiUltimaActividad)
                : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase text-gray-500">
              Top 3 asesores
            </div>
            <ul className="mt-1 space-y-0.5 text-sm text-gray-900">
              {top3Asesores.length === 0 ? (
                <li>—</li>
              ) : (
                top3Asesores.map((r) => (
                  <li key={r.asesorId}>
                    {getAsesorDisplayLabel(r.asesorId, asesorMap)}: {r.total}
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        {/* Resumen por asesor (filtrado) */}
        <section>
          <h2 className="mb-4 text-xl font-medium text-gray-900">
            Precalificaciones por asesor
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Asesor (asesorId)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Total precalificaciones
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Última precalificación
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {resumenPorAsesor.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No hay datos.
                    </td>
                  </tr>
                ) : (
                  resumenPorAsesor.map((r) => (
                    <tr key={r.asesorId} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {getAsesorDisplayLabel(r.asesorId, asesorMap)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {r.total}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDateTimeMx(r.ultimaCreatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Toggle agrupar por fecha */}
        <section className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={groupByDate}
              onChange={(e) => setGroupByDate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Agrupar por fecha
            </span>
          </label>
        </section>

        {/* Paginación */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages || 1} · Total: {totalCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!canPrevious}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={!canNext}
            >
              Siguiente
            </Button>
          </div>
        </div>

        {/* Tabla(s) */}
        <section>
          <h2 className="mb-4 text-xl font-medium text-gray-900">
            Todas las precalificaciones
          </h2>
          {groupByDate ? (
            <div className="space-y-6">
              {groupedByDay.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white py-8 text-center text-sm text-gray-500">
                  No hay precalificaciones.
                </div>
              ) : (
                groupedByDay.map(([dateKey, dayList]) => (
                  <div key={dateKey}>
                    <h3 className="mb-2 text-sm font-semibold text-gray-800">
                      {formatDateKeyToDisplay(dateKey)} ({dayList.length})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200">
                        {ADMIN_TABLE_HEAD}
                        <tbody className="divide-y divide-gray-200 bg-white">
                          <AdminTableBody
                            list={dayList}
                            editHref={(id) => `/admin/${id}`}
                            asesorMap={asesorMap}
                          />
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                {ADMIN_TABLE_HEAD}
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        No hay precalificaciones.
                      </td>
                    </tr>
                  ) : (
                    <AdminTableBody
                      list={filteredList}
                      editHref={(id) => `/admin/${id}`}
                      asesorMap={asesorMap}
                    />
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
