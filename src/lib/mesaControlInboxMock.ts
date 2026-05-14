export interface MesaControlInboxItem {
  id?: string;
  idPrecal?: string;
  cliente_nombre?: string;
  telefono_cliente?: string;
  programa?: string;
  asesorNombre?: string;
  etapaActual?: number | null;
  subestado?: string | null;
  motivoRechazo?: string | null;
  comentarioRechazo?: string | null;
  fechaCita?: string | null;
  /** Si existe en JSON del inbox, prioridad de orden en bandeja mesa (envío inicial a mesa). */
  fechaEnvioMesa?: string | null;
  updatedAt?: string | null;
  submittedToMesa?: boolean;
  [key: string]: unknown;
}

function mesaInboxItemKey(i: MesaControlInboxItem): string | null {
  const tryKey = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  return tryKey(i.idPrecal) ?? tryKey(i.id);
}

/**
 * Cuando `mesa_control_inbox` tiene filas duplicadas para el mismo expediente,
 * conserva la entrada con `updatedAt` más reciente (ISO). Evita que un registro
 * viejo sobrescriba en el Map al iterar en orden de array.
 */
export function mergeMesaControlInboxByLatestUpdated(
  inbox: MesaControlInboxItem[],
): Map<string, MesaControlInboxItem> {
  const map = new Map<string, MesaControlInboxItem>();
  for (const item of inbox) {
    if (!item) continue;
    const key = mesaInboxItemKey(item);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    const tPrev = typeof prev.updatedAt === "string" ? prev.updatedAt : "";
    const tCur = typeof item.updatedAt === "string" ? item.updatedAt : "";
    if (tCur >= tPrev) map.set(key, item);
  }
  return map;
}

export function readMesaControlInboxSafe(): MesaControlInboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("mesa_control_inbox");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => !!x) as MesaControlInboxItem[];
  } catch (err) {
    console.error(
      "[mesa_control_inbox] error leyendo inbox mock:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
