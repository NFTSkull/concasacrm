import { resetMockArchivosIndexedDbConnection } from "@/domain/expediente-archivos/mock-indexeddb.repo";
import { ASESORES_TIPO_MESA_KEY_V1 } from "@/lib/asesorTipoMesaMock";
import {
  AGENDA_FIRMAS_BOOKINGS_KEY_V1,
  AGENDA_FIRMAS_CONFIG_KEY_V1,
} from "@/lib/agendaFirmasBookingsGuard";
import { MOCK_USER_KEY } from "@/lib/mockUser";

/**
 * Claves localStorage usadas por mocks en el repo (precalificaciones, decisiones, inbox, cliente).
 * Incluye sesión mock (`concasa_session`, `mock_role`, `mock_email`) para pruebas desde cero.
 */
export const MOCK_LOCAL_STORAGE_KEYS = [
  "precalificaciones_mock",
  "decisions_mock",
  "mesa_control_inbox",
  "agenda_biometricos_config",
  "agenda_config_v1",
  "agenda_bookings_v1",
  AGENDA_FIRMAS_CONFIG_KEY_V1,
  AGENDA_FIRMAS_BOOKINGS_KEY_V1,
  ASESORES_TIPO_MESA_KEY_V1,
  "expediente_cliente_datos",
  MOCK_USER_KEY,
  "mock_role",
  "mock_email",
  "concasa_session",
] as const;

/** Nombre real de la BD IndexedDB de archivos de expediente (`mock-indexeddb.repo.ts`). */
export const MOCK_INDEXEDDB_NAMES = ["concasa-crm-files"] as const;

function deleteDatabaseAsync(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("deleteDatabase"));
    req.onblocked = () => resolve();
  });
}

/**
 * Borra datos mock persistidos (localStorage + IndexedDB de archivos).
 * Solo usar en desarrollo / pruebas manuales.
 */
export async function clearAllMockData(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    for (const key of MOCK_LOCAL_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
    console.log("[DEV] localStorage limpiado:", [...MOCK_LOCAL_STORAGE_KEYS].join(", "));

    if (typeof indexedDB !== "undefined") {
      await Promise.all(
        MOCK_INDEXEDDB_NAMES.map((dbName) => deleteDatabaseAsync(dbName)),
      );
      resetMockArchivosIndexedDbConnection();
      console.log("[DEV] IndexedDB limpiado:", [...MOCK_INDEXEDDB_NAMES].join(", "));
    }

    console.log("[DEV] TODO LIMPIO (recarga la página si algo quedó en caché de módulos).");
  } catch (error) {
    console.error("[DEV] Error limpiando datos", error);
    throw error;
  }
}

declare global {
  interface Window {
    /** Solo en desarrollo: `await clearMockData()` en consola. */
    clearMockData?: () => Promise<void>;
  }
}

/** Registra `window.clearMockData` (solo `NODE_ENV !== 'production'`). */
export function registerClearMockDataGlobal(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production") return;
  window.clearMockData = () => clearAllMockData();
}
