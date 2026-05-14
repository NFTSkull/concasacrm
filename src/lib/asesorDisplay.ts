/**
 * Helper para mostrar nombre/email del asesor a partir de user_profiles.
 * precalificaciones.asesorId = uuid; user_profiles.id = uuid, tiene email y role.
 * Cache en memoria por sesión (módulo) para no repetir la query en cada render.
 */

import { supabase } from "@/lib/supabaseClient";

let cache: Map<string, string> | null = null;
let loggedError = false;

/**
 * Obtiene un mapa asesorId (uuid) -> email desde user_profiles (role = asesor).
 * Usa cache en memoria; una sola petición por carga de la app.
 * En caso de error de Supabase, nunca lanza; devuelve Map vacío y loggea una sola vez.
 */
export async function getAsesorDisplayMap(): Promise<{
  map: Map<string, string>;
  error: Error | null;
}> {
  if (cache) return { map: cache, error: null };
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email")
      .eq("role", "asesor");
    if (error) {
      if (!loggedError) {
        const errObj = error as unknown as {
          details?: unknown;
          hint?: unknown;
        };
        console.error("[asesorMap] supabase error:", {
          message: error.message,
          details: errObj.details,
          hint: errObj.hint,
        });
        loggedError = true;
      }
      const empty = new Map<string, string>();
      cache = empty;
      return { map: empty, error: new Error(error.message) };
    }
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const id = row.id != null ? String(row.id) : "";
      const email = row.email != null ? String(row.email) : "";
      if (id) map.set(id, email);
    }
    cache = map;
    return { map, error: null };
  } catch (e) {
    if (!loggedError) {
      console.error("[asesorMap] unexpected error:", e);
      loggedError = true;
    }
    const empty = new Map<string, string>();
    cache = empty;
    return { map: empty, error: e instanceof Error ? e : new Error("asesorMap error") };
  }
}

/**
 * Deriva un nombre visible desde email: parte antes de @, puntos por espacios, capitalizar palabras.
 */
export function asesorDisplayName(email: string): string {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return "";
  const beforeAt = trimmed.includes("@") ? trimmed.split("@")[0]! : trimmed;
  const words = beforeAt.replace(/\./g, " ").split(/\s+/).filter(Boolean);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Devuelve el texto a mostrar para un asesorId: nombre derivado del email si existe, sino asesorId (fallback).
 */
export function getAsesorDisplayLabel(asesorId: string, asesorMap: Map<string, string>): string {
  const email = asesorMap.get(asesorId);
  if (email) return asesorDisplayName(email);
  return asesorId;
}
