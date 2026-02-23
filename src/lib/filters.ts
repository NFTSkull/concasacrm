import type { Precalificacion, Programa } from "@/lib/mock-store";

export interface FiltersState {
  asesorId: string;
  programa: string;
  buscar: string;
  desde: string;
  hasta: string;
}

export const DEFAULT_FILTERS: FiltersState = {
  asesorId: "",
  programa: "",
  buscar: "",
  desde: "",
  hasta: "",
};

function getStartOfDay(ymd: string): number {
  const d = new Date(ymd + "T00:00:00.000");
  return d.getTime();
}

function getEndOfDay(ymd: string): number {
  const d = new Date(ymd + "T23:59:59.999");
  return d.getTime();
}

/**
 * Aplica filtros a la lista de precalificaciones.
 * Desde/Hasta usan inicio del día (00:00) y fin del día (23:59:59) respectivamente.
 */
export function applyFilters(
  precalificaciones: Precalificacion[],
  filters: FiltersState
): Precalificacion[] {
  let result = [...precalificaciones];

  if (filters.asesorId) {
    result = result.filter((p) => p.asesorId === filters.asesorId);
  }
  if (filters.programa) {
    result = result.filter((p) => p.programa === (filters.programa as Programa));
  }
  if (filters.buscar.trim()) {
    const q = filters.buscar.toLowerCase().trim();
    result = result.filter(
      (p) =>
        p.nss.toLowerCase().includes(q) ||
        (p.cliente_nombre ?? "").toLowerCase().includes(q) ||
        (p.telefono_cliente ?? "").includes(q) ||
        (p.direccion_opcional ?? "").toLowerCase().includes(q) ||
        (p.notas ?? "").toLowerCase().includes(q) ||
        (p.monto_aprobado != null && String(p.monto_aprobado).includes(q))
    );
  }
  if (filters.desde) {
    const start = getStartOfDay(filters.desde);
    result = result.filter(
      (p) => new Date(p.createdAt).getTime() >= start
    );
  }
  if (filters.hasta) {
    const end = getEndOfDay(filters.hasta);
    result = result.filter(
      (p) => new Date(p.createdAt).getTime() <= end
    );
  }

  return result;
}

/**
 * Agrupa precalificaciones por día (YYYY-MM-DD).
 * Retorna entradas ordenadas por fecha descendente (más reciente primero).
 */
export function groupByDay(
  precalificaciones: Precalificacion[]
): [string, Precalificacion[]][] {
  const map = new Map<string, Precalificacion[]>();
  for (const p of precalificaciones) {
    const d = new Date(p.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }
  return Array.from(map.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  );
}

/**
 * Formatea ISO string a "dd/mm/yyyy HH:mm" (24h).
 */
export function formatDateTimeMx(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${min}`;
}

/** Convierte YYYY-MM-DD a dd/mm/yyyy para títulos de sección */
export function formatDateKeyToDisplay(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

/**
 * Convierte createdAt (ISO) a clave de día local YYYY-MM-DD.
 */
export function toDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DaySummary {
  dayKey: string;
  total: number;
  pendientes: number;
  aprobadas: number;
  noCumple: number;
  lastAt: string;
}

/**
 * Resumen por día. decision faltante se trata como "pendiente".
 * Ordenado por día descendente.
 */
export function summarizeByDay(
  precalificaciones: Precalificacion[]
): DaySummary[] {
  const byDay = new Map<
    string,
    { total: number; pendientes: number; aprobadas: number; noCumple: number; lastAt: string }
  >();
  for (const p of precalificaciones) {
    const key = toDayKey(p.createdAt);
    if (!key) continue;
    const d = p.decision ?? "pendiente";
    const prev = byDay.get(key);
    const pendientes = (prev?.pendientes ?? 0) + (d === "pendiente" ? 1 : 0);
    const aprobadas = (prev?.aprobadas ?? 0) + (d === "aprobado" ? 1 : 0);
    const noCumple = (prev?.noCumple ?? 0) + (d === "no_cumple" ? 1 : 0);
    const lastAt =
      !prev || p.createdAt > prev.lastAt ? p.createdAt : prev.lastAt;
    byDay.set(key, {
      total: (prev?.total ?? 0) + 1,
      pendientes,
      aprobadas,
      noCumple,
      lastAt,
    });
  }
  return Array.from(byDay.entries())
    .map(([dayKey, data]) => ({ dayKey, ...data }))
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}
