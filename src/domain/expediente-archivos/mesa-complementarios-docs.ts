import {
  DOCUMENTO_CATALOGO_MAP,
  findRowPorTipoDocumento,
  type ExpedienteArchivoResumen,
  type ResumenEstatus,
  type TipoDocumentoCatalogo,
} from "./types";
import { INTEGRATION_DOC_TIPOS_MESA_UPLOAD, type IntegrationDocMesaUploadTipo } from "./integration-docs-completos";
import { mesaPuedeAbrirArchivo } from "./mesa-archivo-acceso";
import type { ExpedienteArchivoListItem } from "./map-supabase-expediente-documentos";
import { integrationDocsResumenFromArchivoResumen } from "./integration-docs-completos";

export type MesaComplementarioPresencia = "faltante" | "cargado";

export type MesaComplementarioDocView = {
  tipo_documento: IntegrationDocMesaUploadTipo;
  label: string;
  estatus_revision: ResumenEstatus;
  presencia: MesaComplementarioPresencia;
  archivo: ExpedienteArchivoResumen | null;
};

function mapPresencia(estatus: ResumenEstatus): MesaComplementarioPresencia {
  if (estatus === "faltante") return "faltante";
  return "cargado";
}

/** Etiqueta neutral en UI — no expone validado/rechazado de complementarios. */
export function labelPresenciaComplementario(presencia: MesaComplementarioPresencia): string {
  return presencia === "faltante" ? "Faltante" : "Cargado";
}

function listItemToResumen(item: ExpedienteArchivoListItem): ExpedienteArchivoResumen {
  return {
    expediente_id: item.expediente_id,
    tipo_documento: item.tipo_documento,
    id: item.id,
    nombre_original: item.nombre_original,
    mime_type: item.mime_type,
    size_bytes: item.size_bytes,
    created_at: item.created_at,
    uploaded_by_role: item.uploaded_by_role,
    uploaded_by_email: item.uploaded_by_email,
    estatus_revision: item.estatus_revision,
    comentario_mesa: item.comentario_mesa,
  };
}

function resolveArchivoPorTipo(
  tipo: IntegrationDocMesaUploadTipo,
  resumenCatalog: readonly ExpedienteArchivoResumen[],
  listaActiva: readonly ExpedienteArchivoListItem[],
): ExpedienteArchivoResumen | null {
  const fromLista = findRowPorTipoDocumento(listaActiva, tipo as TipoDocumentoCatalogo);
  if (fromLista) return listItemToResumen(fromLista);

  const fromCatalog = findRowPorTipoDocumento(resumenCatalog, tipo as TipoDocumentoCatalogo);
  if (fromCatalog && mesaPuedeAbrirArchivo(fromCatalog)) return fromCatalog;

  return null;
}

/** Checklist documentos complementarios / Mesa de Control (3 tipos opcionales). */
export function buildMesaComplementariosDocViews(
  resumenCatalog: readonly ExpedienteArchivoResumen[],
  listaActiva: readonly ExpedienteArchivoListItem[] = [],
): MesaComplementarioDocView[] {
  const input = integrationDocsResumenFromArchivoResumen(resumenCatalog);
  const byTipo = new Map(input.map((r) => [r.tipo_documento, r.estatus_revision]));

  return INTEGRATION_DOC_TIPOS_MESA_UPLOAD.map((tipo) => {
    const estatus_revision = byTipo.get(tipo) ?? "faltante";
    const archivo = resolveArchivoPorTipo(tipo, resumenCatalog, listaActiva);
    return {
      tipo_documento: tipo,
      label: DOCUMENTO_CATALOGO_MAP[tipo].label,
      estatus_revision,
      presencia: mapPresencia(estatus_revision),
      archivo,
    };
  });
}

/** Los 3 complementarios Mesa no cuentan en obligatorios ni validación documental. */
export function complementariosMesaSonOpcionales(): boolean {
  return true;
}

/** @deprecated Usar `complementariosMesaSonOpcionales`. */
export function semanasCotizadasEsOpcionalMesa(): boolean {
  return complementariosMesaSonOpcionales();
}
