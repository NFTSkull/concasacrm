import type { OrigenMesa } from "@/domain/expedientes/mock.repo";

/** Clave `localStorage` para catálogo mock (super_admin puede escribir en fases posteriores). */
export const ASESORES_TIPO_MESA_KEY_V1 = "asesores_tipo_mesa_v1";

type StoreV1 = {
  v: 1;
  /** Email normalizado (minúsculas, trim) → tipo para reglas de mesa. */
  byEmail: Record<string, OrigenMesa>;
};

function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const s = String(email).trim().toLowerCase();
  return s === "" ? null : s;
}

function readStore(): StoreV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ASESORES_TIPO_MESA_KEY_V1);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    if (o.v !== 1 || typeof o.byEmail !== "object" || o.byEmail === null) return null;
    return { v: 1, byEmail: o.byEmail as Record<string, OrigenMesa> };
  } catch {
    return null;
  }
}

/**
 * Tipo del asesor para Mesa (mismos literales que `origenMesa` del expediente).
 * Si no hay entrada en catálogo: **`interno`** (evita `origenMesa` nulo en envíos nuevos).
 */
export function getTipoAsesorForEmail(email: string | null | undefined): OrigenMesa {
  const k = normalizeEmail(email);
  if (!k) return "interno";
  const store = readStore();
  if (!store) return "interno";
  const t = store.byEmail[k];
  return t === "externo" ? "externo" : "interno";
}

/** Alias explícito: el origen de mesa se deriva del email del asesor dueño del expediente. */
export function origenMesaDesdeEmailAsesor(email: string | null | undefined): OrigenMesa {
  return getTipoAsesorForEmail(email);
}
