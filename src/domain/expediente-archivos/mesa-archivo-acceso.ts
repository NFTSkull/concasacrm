import type { ExpedienteArchivoResumen } from "./types";

/** Documento con fila real y estatus distinto de faltante — habilita preview/descarga Mesa. */
export function mesaPuedeAbrirArchivo(
  resumen: Pick<ExpedienteArchivoResumen, "id" | "estatus_revision"> | null | undefined,
): boolean {
  if (!resumen?.id) return false;
  return resumen.estatus_revision !== "faltante";
}
