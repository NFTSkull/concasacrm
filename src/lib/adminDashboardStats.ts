import type { ExpedienteMock } from "@/domain/expedientes/mock.repo";

/** KPIs operativos globales (visión `mockList` / `ExpedienteMock[]`). Cada contador es independiente. */
export type AdminOperativoKpis = Readonly<{
  total: number;
  enProceso: number;
  enMesa: number;
  enBiometricos: number;
  enFirma: number;
  firmados: number;
  rechazadosOperativo: number;
  rechazadosEditor: number;
}>;

/** Funnel mutuamente excluyente por prioridad de etapa / envío a mesa. */
export type AdminFunnelExclusive = Readonly<{
  precal: number;
  mesa: number;
  biometricos: number;
  tramite: number;
  firma: number;
  finalizado: number;
  otros: number;
}>;

/** Histograma crudo por `etapaActual` (incluye `null`). */
export type AdminFunnelByEtapa = Readonly<{
  byEtapa: Readonly<Record<number, number>>;
  sinEtapa: number;
}>;

function normSub(e: ExpedienteMock): string {
  return String(e.operativo.subestado ?? "pendiente").trim();
}

function etapa(e: ExpedienteMock): number | null {
  const n = e.operativo.etapaActual;
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
}

/**
 * KPIs operativos. Definiciones:
 * - en proceso: `subestado === "en_proceso"`.
 * - en mesa: enviado a mesa y (etapa 1–2 o subestado en validación mesa).
 * - en biométricos: enviado a mesa y etapa 3–5.
 * - en firma: enviado a mesa y etapa 9–10.
 * - firmados: `etapaActual >= 11`.
 * - rechazados operativo: `subestado === "rechazado"`.
 * - rechazados editor: decisión editor `no_cumple`.
 */
export function computeAdminOperativoKpis(
  expedientes: readonly ExpedienteMock[],
): AdminOperativoKpis {
  let total = 0;
  let enProceso = 0;
  let enMesa = 0;
  let enBiometricos = 0;
  let enFirma = 0;
  let firmados = 0;
  let rechazadosOperativo = 0;
  let rechazadosEditor = 0;

  for (const e of expedientes) {
    total += 1;
    const sub = normSub(e);
    const et = etapa(e);
    const sm = e.operativo.submittedToMesa;

    if (sub === "en_proceso") enProceso += 1;
    if (
      sm &&
      (sub === "en_validacion_mesa" || et === 1 || et === 2)
    ) {
      enMesa += 1;
    }
    if (sm && et != null && et >= 3 && et <= 5) enBiometricos += 1;
    if (sm && et != null && et >= 9 && et <= 10) enFirma += 1;
    if (et != null && et >= 11) firmados += 1;
    if (sub === "rechazado") rechazadosOperativo += 1;
    if (e.editorDecision.decision === "no_cumple") rechazadosEditor += 1;
  }

  return {
    total,
    enProceso,
    enMesa,
    enBiometricos,
    enFirma,
    firmados,
    rechazadosOperativo,
    rechazadosEditor,
  };
}

/**
 * Funnel excluyente (cada expediente cuenta en una sola categoría), prioridad:
 * finalizado (>=11) → firma (9–10) → trámite (6–8) → biométricos (3–5) → mesa (enviado y etapa 1–2 o en_validacion_mesa) → precal (!enviado) → otros.
 */
export function computeAdminFunnelExclusive(
  expedientes: readonly ExpedienteMock[],
): AdminFunnelExclusive {
  let precal = 0;
  let mesa = 0;
  let biometricos = 0;
  let tramite = 0;
  let firma = 0;
  let finalizado = 0;
  let otros = 0;

  for (const e of expedientes) {
    const sub = normSub(e);
    const et = etapa(e);
    const sm = e.operativo.submittedToMesa;

    if (et != null && et >= 11) {
      finalizado += 1;
      continue;
    }
    if (sm && et != null && et >= 9 && et <= 10) {
      firma += 1;
      continue;
    }
    if (sm && et != null && et >= 6 && et <= 8) {
      tramite += 1;
      continue;
    }
    if (sm && et != null && et >= 3 && et <= 5) {
      biometricos += 1;
      continue;
    }
    if (sm && (sub === "en_validacion_mesa" || et === 1 || et === 2)) {
      mesa += 1;
      continue;
    }
    if (!sm) {
      precal += 1;
      continue;
    }
    otros += 1;
  }

  return {
    precal,
    mesa,
    biometricos,
    tramite,
    firma,
    finalizado,
    otros,
  };
}

/** Conteos por número de etapa 1..12; `sinEtapa` para `etapaActual` null. */
export function computeAdminFunnelByEtapa(
  expedientes: readonly ExpedienteMock[],
): AdminFunnelByEtapa {
  const byEtapa: Record<number, number> = {};
  for (let i = 1; i <= 12; i += 1) byEtapa[i] = 0;
  let sinEtapa = 0;

  for (const e of expedientes) {
    const et = etapa(e);
    if (et == null || et < 1 || et > 12) {
      sinEtapa += 1;
      continue;
    }
    byEtapa[et] = (byEtapa[et] ?? 0) + 1;
  }

  return { byEtapa, sinEtapa };
}

type AsesorAcc = {
  totalExpedientes: number;
  enviadosMesa: number;
  enBiometricos: number;
  enFirma: number;
  firmados: number;
  rechazadosOperativo: number;
  rechazadosEditor: number;
};

function bumpAsesor(acc: AsesorAcc, e: ExpedienteMock): void {
  acc.totalExpedientes += 1;
  const sub = normSub(e);
  const et = etapa(e);
  const sm = e.operativo.submittedToMesa;

  if (sm) acc.enviadosMesa += 1;
  if (sm && et != null && et >= 3 && et <= 5) acc.enBiometricos += 1;
  if (sm && et != null && et >= 9 && et <= 10) acc.enFirma += 1;
  if (et != null && et >= 11) acc.firmados += 1;
  if (sub === "rechazado") acc.rechazadosOperativo += 1;
  if (e.editorDecision.decision === "no_cumple") acc.rechazadosEditor += 1;
}

/** Fila agregada por `base.asesorId` (vacío → `(sin asesor)`). */
export type AdminAsesorMetricsRow = Readonly<{
  asesorId: string;
  totalExpedientes: number;
  enviadosMesa: number;
  enBiometricos: number;
  enFirma: number;
  firmados: number;
  rechazadosOperativo: number;
  rechazadosEditor: number;
  /** `firmados / enviadosMesa` por asesor; `null` si `enviadosMesa === 0`. */
  conversionFirmadosSobreEnviadosMesa: number | null;
}>;

const EMPTY_ASESOR_ACC: AsesorAcc = {
  totalExpedientes: 0,
  enviadosMesa: 0,
  enBiometricos: 0,
  enFirma: 0,
  firmados: 0,
  rechazadosOperativo: 0,
  rechazadosEditor: 0,
};

/**
 * Métricas por asesor solo desde `ExpedienteMock` (agrupa por `asesorId` en base).
 * Mismas reglas de conteo que en el dashboard global para biométricos, firma, firmados y rechazos.
 */
export function computeAdminMetricsByAsesor(
  expedientes: readonly ExpedienteMock[],
): readonly AdminAsesorMetricsRow[] {
  const map = new Map<string, AsesorAcc>();

  for (const e of expedientes) {
    const raw = String(e.base.asesorId ?? "").trim();
    const key = raw === "" ? "(sin asesor)" : raw;
    let acc = map.get(key);
    if (!acc) {
      acc = { ...EMPTY_ASESOR_ACC };
      map.set(key, acc);
    }
    bumpAsesor(acc, e);
  }

  const rows: AdminAsesorMetricsRow[] = [...map.entries()].map(([asesorId, a]) => ({
    asesorId,
    totalExpedientes: a.totalExpedientes,
    enviadosMesa: a.enviadosMesa,
    enBiometricos: a.enBiometricos,
    enFirma: a.enFirma,
    firmados: a.firmados,
    rechazadosOperativo: a.rechazadosOperativo,
    rechazadosEditor: a.rechazadosEditor,
    conversionFirmadosSobreEnviadosMesa:
      a.enviadosMesa === 0 ? null : a.firmados / a.enviadosMesa,
  }));

  rows.sort((x, y) => {
    if (y.totalExpedientes !== x.totalExpedientes) {
      return y.totalExpedientes - x.totalExpedientes;
    }
    return x.asesorId.localeCompare(y.asesorId, "es");
  });

  return rows;
}

const MS_PER_DAY = 86_400_000;
const BOTTLENECK_MIN_SAMPLE = 3;

function parseIsoMs(value: string | null | undefined): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** `updatedAt - createdAt` en ms; `null` si falta dato o el intervalo es inválido. */
function intervaloAntiguedadOperativoMs(e: ExpedienteMock): number | null {
  const t0 = parseIsoMs(e.base.createdAt);
  const t1 = parseIsoMs(e.operativo.updatedAt);
  if (t0 == null || t1 == null) return null;
  const dt = t1 - t0;
  return dt < 0 ? null : dt;
}

function meanMsToDays(meanMs: number): number {
  return meanMs / MS_PER_DAY;
}

/** Promedio `{ meanDays, sampleSize }` o `null` si no hay muestra. */
export type AdminTimeMeanDays = Readonly<{
  meanDays: number;
  sampleSize: number;
}>;

/** Antigüedad media por valor actual de `etapaActual` (bucket “sin etapa” para `null`). */
export type AdminAntiguedadPorEtapaRow = Readonly<{
  etapa: number | null;
  meanDays: number;
  sampleSize: number;
}>;

export type AdminTimeBottleneck = Readonly<{
  etapa: number | null;
  meanDays: number;
  sampleSize: number;
}>;

export type AdminSlowExpedienteRow = Readonly<{
  id: string;
  etapaActual: number | null;
  submittedToMesa: boolean;
  totalDays: number;
  createdAt: string;
  updatedAt: string;
}>;

/**
 * Métricas de tiempos solo con `createdAt`, `updatedAt`, `etapaActual` y `submittedToMesa`
 * (este último solo informativo en el top). Sin tramos reales ni envío a mesa estimado.
 */
export type AdminTimeMetrics = Readonly<{
  /** `etapaActual >= 11` y ambos timestamps válidos. */
  tiempoTotalPromedioFirmados: AdminTimeMeanDays | null;
  antiguedadPorEtapa: readonly AdminAntiguedadPorEtapaRow[];
  cuelloDeBotella: AdminTimeBottleneck | null;
  top10MasLentos: readonly AdminSlowExpedienteRow[];
}>;

type EtapaBucketKey = number | "sin_etapa";

function etapaBucketKey(e: ExpedienteMock): EtapaBucketKey {
  const n = etapa(e);
  return n == null ? "sin_etapa" : n;
}

export function computeAdminTimeMetrics(
  expedientes: readonly ExpedienteMock[],
): AdminTimeMetrics {
  let sumMsFirmados = 0;
  let nFirmados = 0;

  const byEtapa = new Map<EtapaBucketKey, { sumMs: number; n: number }>();

  const slowCandidates: AdminSlowExpedienteRow[] = [];

  for (const e of expedientes) {
    const dt = intervaloAntiguedadOperativoMs(e);
    if (dt == null) continue;

    const et = etapa(e);
    if (et != null && et >= 11) {
      sumMsFirmados += dt;
      nFirmados += 1;
    }

    const key = etapaBucketKey(e);
    let acc = byEtapa.get(key);
    if (!acc) {
      acc = { sumMs: 0, n: 0 };
      byEtapa.set(key, acc);
    }
    acc.sumMs += dt;
    acc.n += 1;

    const t1s = String(e.operativo.updatedAt ?? "").trim();
    const t0s = String(e.base.createdAt ?? "").trim();
    slowCandidates.push({
      id: e.id,
      etapaActual: et,
      submittedToMesa: e.operativo.submittedToMesa,
      totalDays: meanMsToDays(dt),
      createdAt: t0s,
      updatedAt: t1s,
    });
  }

  const tiempoTotalPromedioFirmados: AdminTimeMeanDays | null =
    nFirmados === 0
      ? null
      : { meanDays: meanMsToDays(sumMsFirmados / nFirmados), sampleSize: nFirmados };

  const antiguedadRows: AdminAntiguedadPorEtapaRow[] = [...byEtapa.entries()].map(([k, a]) => ({
    etapa: k === "sin_etapa" ? null : k,
    meanDays: meanMsToDays(a.sumMs / a.n),
    sampleSize: a.n,
  }));

  antiguedadRows.sort((x, y) => {
    if (x.etapa == null && y.etapa == null) return 0;
    if (x.etapa == null) return 1;
    if (y.etapa == null) return -1;
    return x.etapa - y.etapa;
  });

  const etapaSortKey = (e: number | null): number => (e == null ? 999 : e);
  const eligibleBottleneck = antiguedadRows.filter(
    (r) => r.sampleSize >= BOTTLENECK_MIN_SAMPLE,
  );
  let cuelloDeBotella: AdminTimeBottleneck | null = null;
  if (eligibleBottleneck.length > 0) {
    const sorted = [...eligibleBottleneck].sort((a, b) => {
      if (b.meanDays !== a.meanDays) return b.meanDays - a.meanDays;
      return etapaSortKey(a.etapa) - etapaSortKey(b.etapa);
    });
    const w = sorted[0];
    cuelloDeBotella = {
      etapa: w.etapa,
      meanDays: w.meanDays,
      sampleSize: w.sampleSize,
    };
  }

  slowCandidates.sort((a, b) => {
    const da = a.totalDays;
    const db = b.totalDays;
    if (db !== da) return db - da;
    return a.id.localeCompare(b.id, "es");
  });

  return {
    tiempoTotalPromedioFirmados,
    antiguedadPorEtapa: antiguedadRows,
    cuelloDeBotella,
    top10MasLentos: slowCandidates.slice(0, 10),
  };
}
