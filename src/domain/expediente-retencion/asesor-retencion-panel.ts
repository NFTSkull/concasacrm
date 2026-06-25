import {
  deriveRetencionAcuseAvisoFaltantes,
  listRetencionUploadsForOpcion,
  RETENCION_ETAPA_OPERATIVA_ID,
  type RetencionFaltanteItem,
} from "@/domain/expediente-archivos/retencion-acuse-aviso";
import type { ExpedienteArchivoResumen } from "@/domain/expediente-archivos/types";
import {
  puedeEnviarRetencionAcuseAvisoAMesa,
  retencionEnvioEstadoEfectivo,
  retencionOpcionAsesorEditable,
  retencionOpcionParaPanelAsesor,
  retencionPuedeReenviarAMesa,
  type RetencionEnvioMesaUiEstado,
} from "./retencion-envio-mesa";
import type {
  ExpedienteRetencionEnvioMesa,
  ExpedienteRetencionOpcion,
  RetencionOpcion,
} from "./types";

/** Panel retención asesor Supabase: etapa 8 y expediente ya enviado a Mesa. */
export function canShowAsesorRetencionSupabasePanel(params: {
  dataModeSupabase: boolean;
  etapaActual: number | null | undefined;
  submittedToMesa: boolean;
}): boolean {
  return (
    params.dataModeSupabase &&
    params.etapaActual === RETENCION_ETAPA_OPERATIVA_ID &&
    params.submittedToMesa === true
  );
}

export function retencionDocEstatusLabelAsesor(
  e: ExpedienteArchivoResumen["estatus_revision"] | undefined,
): string {
  if (!e || e === "faltante") return "Faltante";
  if (e === "subido") return "Subido — Mesa revisará después del envío";
  if (e === "resubido") return "Resubido — Mesa revisará de nuevo";
  if (e === "validado") return "Aceptado por Mesa";
  return "Rechazado por Mesa";
}

export function asesorRetencionBloqueEstadoLabel(
  uiEstado: RetencionEnvioMesaUiEstado,
): string {
  if (uiEstado === "no_enviado") return "Pendiente de envío a Mesa";
  if (uiEstado === "correccion_requerida") return "Corrección requerida";
  return "Enviado a Mesa — pendiente de revisión";
}

type ArchivoRowMin = Pick<
  ExpedienteArchivoResumen,
  "tipo_documento" | "id" | "estatus_revision"
>;

export type AsesorRetencionPanelView = Readonly<{
  opcionPanel: RetencionOpcion | null;
  opcionEditable: boolean;
  uiEstado: RetencionEnvioMesaUiEstado;
  bloqueEstadoLabel: string;
  faltantes: readonly RetencionFaltanteItem[];
  puedeEnviarAMesa: boolean;
  uploads: ReturnType<typeof listRetencionUploadsForOpcion>;
}>;

export function deriveAsesorRetencionPanelView(params: {
  opcionDraft: RetencionOpcion | null;
  opcionPersistida: ExpedienteRetencionOpcion | null;
  envio: ExpedienteRetencionEnvioMesa | null;
  archivos: readonly ArchivoRowMin[];
}): AsesorRetencionPanelView {
  const opcionDb = params.opcionPersistida?.retencion_opcion ?? null;
  const opcionEfectiva = opcionDb ?? params.opcionDraft;
  const uiEstado = retencionEnvioEstadoEfectivo(
    params.envio,
    params.archivos,
    opcionEfectiva,
  );
  const opcionPanel =
    retencionOpcionParaPanelAsesor(params.envio, opcionEfectiva, uiEstado) ??
    params.opcionDraft;
  const opcionEditable = retencionOpcionAsesorEditable(uiEstado);
  const faltantes = deriveRetencionAcuseAvisoFaltantes({
    retencion_opcion: opcionPanel,
    archivos: params.archivos,
  });
  const puedeEnviarAMesa =
    opcionPanel !== null &&
    retencionPuedeReenviarAMesa(uiEstado, faltantes) &&
    puedeEnviarRetencionAcuseAvisoAMesa(faltantes);

  return {
    opcionPanel,
    opcionEditable,
    uiEstado,
    bloqueEstadoLabel: asesorRetencionBloqueEstadoLabel(uiEstado),
    faltantes,
    puedeEnviarAMesa,
    uploads: listRetencionUploadsForOpcion(opcionPanel),
  };
}
