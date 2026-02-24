/**
 * Helper para mostrar nombre/email del asesor a partir de user_profiles.
 * precalificaciones.asesorId = uuid; user_profiles.id = uuid, tiene email y role.
 * Cache en memoria por sesión (módulo) para no repetir la query en cada render.
 */

import { supabase } from "@/lib/supabaseClient";

let cache: Map<string, string> | null = null;

/**
 * Obtiene un mapa asesorId (uuid) -> email desde user_profiles (role = asesor).
 * Usa cache en memoria; una sola petición por carga de la app.
 */
export async function getAsesorDisplayMap(): Promise<Map<string, string>> {
  if (cache) return cache;
  console.log("[asesorMap] fetching user_profiles...");
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email")
    .eq("role", "asesor");
  console.log("[asesorMap] rows recibidas:", data);
  console.log("[asesorMap] error:", error);
  const sessionInfo = await supabase.auth.getSession();
  console.log("[asesorMap] session:", sessionInfo);
  if (error) {
    console.error("[asesorMap] supabase error:", error);
    throw new Error(error.message);
  }
  console.log("[asesorMap] rows:", data?.length);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const id = row.id != null ? String(row.id) : "";
    const email = row.email != null ? String(row.email) : "";
    if (id) map.set(id, email);
  }
  console.log("[asesorMap] map size:", map.size);
  cache = map;
  return map;
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
