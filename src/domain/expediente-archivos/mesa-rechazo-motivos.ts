/** Motivos rápidos de rechazo documental en Mesa (P3J.4). */
export const MESA_RECHAZO_MOTIVOS_SUGERIDOS = [
  "Imagen borrosa",
  "Documento incompleto",
  "No coincide con los datos del cliente",
  "Documento vencido",
  "Archivo incorrecto",
  "Otro",
] as const;

export type MesaRechazoMotivoSugerido = (typeof MESA_RECHAZO_MOTIVOS_SUGERIDOS)[number];

export function isMotivoOtro(motivo: string): boolean {
  return motivo.trim().toLowerCase() === "otro";
}

/** Texto final para `comentario_mesa` al rechazar (obligatorio y sin usar solo «Otro»). */
export function buildComentarioRechazoDocumento(
  motivoSeleccionado: string,
  textoManual: string,
): string | null {
  const manual = textoManual.trim();
  const seleccion = motivoSeleccionado.trim();

  if (isMotivoOtro(seleccion)) {
    return manual.length > 0 ? manual : null;
  }

  if (seleccion.length > 0 && !isMotivoOtro(seleccion)) {
    return seleccion;
  }

  return manual.length > 0 ? manual : null;
}
