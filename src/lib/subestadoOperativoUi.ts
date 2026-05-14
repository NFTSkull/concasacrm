/**
 * Mapeo UI para `operativo.subestado` (mock inbox / expedientes).
 * Centraliza etiquetas y estilos de badge en dashboards.
 */

export function subestadoOperativoLabel(
  subestado: string | null | undefined,
): string {
  const s = String(subestado ?? "pendiente").trim();
  switch (s) {
    case "en_validacion_mesa":
      return "En validación por mesa";
    case "en_proceso":
      return "En proceso";
    case "aprobado":
      return "Aprobado";
    case "rechazado":
      return "Rechazado";
    case "pendiente":
    default:
      return "Pendiente";
  }
}

/** Badges: sin verde salvo aprobado; validación mesa = alto contraste (legible en tablas). */
export function subestadoOperativoBadgeClass(
  subestado: string | null | undefined,
): string {
  const s = String(subestado ?? "pendiente").trim();
  if (s === "en_validacion_mesa") {
    return "bg-blue-600 text-white border border-blue-600";
  }
  if (s === "en_proceso") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }
  if (s === "aprobado") {
    return "bg-green-100 text-green-800 border border-green-200";
  }
  if (s === "rechazado") {
    return "bg-red-100 text-red-800 border border-red-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
}
