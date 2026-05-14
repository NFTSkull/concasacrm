/**
 * Modo mock: no hay backend de perfiles de asesores.
 * Devolvemos mapa vacío y la UI cae al fallback por `asesorId`.
 */
export async function getAsesorDisplayMap(): Promise<{
  map: Map<string, string>;
  error: Error | null;
}> {
  return { map: new Map<string, string>(), error: null };
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
  if (asesorId.includes("@")) return asesorDisplayName(asesorId);
  return asesorId;
}
