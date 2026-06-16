import {
  findRowPorTipoDocumento,
  type TipoDocumentoCatalogo,
} from "@/domain/expediente-archivos/types";
import { tiposRequeridosRetencion } from "@/domain/expediente-archivos/retencion-acuse-aviso";
import type { RetencionFaltanteItem } from "@/domain/expediente-archivos/retencion-acuse-aviso";
import type {
  ExpedienteRetencionEnvioMesa,
  RetencionEnvioMesaEstado,
  RetencionOpcion,
} from "./types";

export type RetencionEnvioMesaUiEstado = "no_enviado" | RetencionEnvioMesaEstado;

type ArchivoRowMin = {
  tipo_documento: TipoDocumentoCatalogo;
  estatus_revision?: string;
};

/**
 * Opción canónica para Mesa en etapa 8: lo enviado oficialmente prima sobre la selección local.
 */
export function retencionOpcionMesaEfectiva(
  envio: ExpedienteRetencionEnvioMesa | null | undefined,
  opcionPersistida: RetencionOpcion | null | undefined,
): RetencionOpcion | null {
  return envio?.opcion ?? opcionPersistida ?? null;
}

export function puedeEnviarRetencionAcuseAvisoAMesa(
  faltantes: readonly RetencionFaltanteItem[],
): boolean {
  return faltantes.length === 0;
}

/** Si hay rechazo en docs de la opción, el envío previo cuenta como corrección requerida. */
export function retencionEnvioEstadoEfectivo(
  envio: ExpedienteRetencionEnvioMesa | null | undefined,
  archivos: readonly ArchivoRowMin[],
  opcionPersistida: RetencionOpcion | null | undefined,
): RetencionEnvioMesaUiEstado {
  if (!envio?.enviado) return "no_enviado";
  const opcion = retencionOpcionMesaEfectiva(envio, opcionPersistida);
  if (!opcion) return "enviado";

  for (const tipo of tiposRequeridosRetencion(opcion)) {
    const row = findRowPorTipoDocumento(archivos, tipo);
    if (row?.estatus_revision === "rechazado") {
      return "correccion_requerida";
    }
  }
  return envio.estado === "correccion_requerida" ? "correccion_requerida" : "enviado";
}

export function rechazoRetencionMesaPermitido(comentario: string): boolean {
  return comentario.trim().length > 0;
}

export function retencionPuedeReenviarAMesa(
  uiEstado: RetencionEnvioMesaUiEstado,
  faltantes: readonly RetencionFaltanteItem[],
): boolean {
  if (faltantes.length > 0) return false;
  return uiEstado === "no_enviado" || uiEstado === "correccion_requerida";
}

/** Mesa puede rechazar un documento de retención aunque ya esté validado (corrección por error). */
export function retencionDocPuedeRechazarMesa(
  estatus: string | undefined,
): boolean {
  if (!estatus || estatus === "faltante") return false;
  return estatus === "subido" || estatus === "resubido" || estatus === "validado" || estatus === "rechazado";
}

/** Asesor solo reemplaza documentos rechazados o faltantes (no los ya validados por Mesa). */
export function retencionDocPuedeReemplazarAsesor(
  estatus: string | undefined,
  hasFile: boolean,
): boolean {
  if (!estatus || estatus === "faltante") return !hasFile;
  return estatus === "rechazado";
}

/** Tras envío en revisión, el asesor no debe cambiar A/B hasta corrección o reenvío. */
export function retencionOpcionAsesorEditable(
  uiEstado: RetencionEnvioMesaUiEstado,
): boolean {
  return uiEstado !== "enviado";
}

/**
 * Opción mostrada en panel asesor: con bloque enviado en revisión, fijar a la opción
 * enviada (canónica para Mesa) para no desalinear uploads con lo que ve Mesa.
 */
export function retencionOpcionParaPanelAsesor(
  envio: ExpedienteRetencionEnvioMesa | null | undefined,
  opcionPersistida: RetencionOpcion | null | undefined,
  uiEstado: RetencionEnvioMesaUiEstado,
): RetencionOpcion | null {
  if (uiEstado === "enviado" && envio?.opcion) {
    return envio.opcion;
  }
  return opcionPersistida ?? null;
}
