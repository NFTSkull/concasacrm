/** Motivos rápidos de rechazo de datos generales en Mesa (P3J.4). */
export const MESA_CLIENTE_DATOS_RECHAZO_MOTIVOS = [
  "RFC incorrecto",
  "CURP incorrecta",
  "Teléfono inválido",
  "Datos de empresa incompletos",
  "Dirección incompleta",
  "Referencias incompletas",
  "Información no coincide con documentos",
  "Otro",
] as const;

export type MesaClienteDatosRechazoMotivo = (typeof MESA_CLIENTE_DATOS_RECHAZO_MOTIVOS)[number];

export function isClienteDatosMotivoOtro(motivo: string): boolean {
  return motivo.trim().toLowerCase() === "otro";
}

export function buildComentarioRechazoClienteDatos(
  motivoSeleccionado: string,
  textoManual: string,
): string | null {
  const manual = textoManual.trim();
  const seleccion = motivoSeleccionado.trim();

  if (isClienteDatosMotivoOtro(seleccion)) {
    return manual.length > 0 ? manual : null;
  }

  if (seleccion.length > 0) {
    return seleccion;
  }

  return manual.length > 0 ? manual : null;
}
