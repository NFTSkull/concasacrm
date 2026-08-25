/**
 * P207 — Motivo de corrección en inbox asesor.
 *
 * Prioridad de presentación (C6):
 * 1. Elementos enriquecidos actuales (DG / docs / retención rechazados).
 * 2. Metadata causal P198 del episodio WAITING_ADVISOR (read-model RPC).
 * 3. Fallback seguro no vacío.
 *
 * No muta estado de negocio; solo presenta.
 */

export type MesaCambioRequestType =
  | "SOLICITUD_DATOS_GENERALES"
  | "SOLICITUD_DOCUMENTAL"
  | "RECHAZO_OPERATIVO_CON_CORRECCION";

export type MesaCambioEstadoEfectivo =
  | "WAITING_ADVISOR"
  | "CORRECTION_PENDING_REVIEW"
  | "CLOSED"
  | "ADVISOR_UPDATE_PENDING_REVIEW"
  | string;

export type AsesorCorreccionItemKind =
  | "datos_generales"
  | "documento"
  | "acuse"
  | "retencion";

export type AsesorCorreccionItem = {
  kind: AsesorCorreccionItemKind;
  key: string;
  label: string;
};

export type AsesorCorreccionEnrichInput = {
  clienteDatosEstado?: string | null;
  archivos?: Array<{
    tipo_documento?: string | null;
    estatus_revision?: string | null;
  }> | null;
  retencionEnvioEstado?: string | null;
};

/** Metadata causal del episodio P198 vigente (read-model, no N+1). */
export type AsesorCorreccionP198Meta = {
  requestType?: MesaCambioRequestType | string | null;
  requestAt?: string | null;
  documentKind?: string | null;
  mesaCambioEstado?: MesaCambioEstadoEfectivo | null;
};

export type AsesorCorreccionCopyInput = {
  estadoEfectivo?: string | null;
  enrich?: AsesorCorreccionEnrichInput | null;
  /** Si el caller ya calculó items; si no, se derivan de `enrich`. */
  enrichItems?: AsesorCorreccionItem[] | null;
  p198?: AsesorCorreccionP198Meta | null;
  /** Catálogo tipo_documento → label humano. */
  documentLabels?: Record<string, string>;
};

export const ASESOR_CORRECCION_FALLBACK_COPY =
  "Mesa tiene una corrección pendiente. Abre el expediente para revisar el detalle.";

/** Labels mínimos alineados al catálogo de producción. */
export const ASESOR_CORRECCION_DOC_LABELS_DEFAULT: Record<string, string> = {
  cliente_ine_frente: "INE frente",
  cliente_ine_reverso: "INE reverso",
  cliente_comprobante_domicilio: "Comprobante de domicilio",
  cliente_estado_cuenta: "Estado de cuenta",
  cliente_semanas_cotizadas: "Semanas cotizadas",
  cliente_acta_nacimiento: "Acta de nacimiento",
  cliente_constancia_sat: "Constancia SAT",
  retencion_acuse_con_sello: "Acuse con sello",
  retencion_carta_sin_sello: "Carta sin sello",
  ine: "INE",
  estado_cuenta: "Estado de cuenta",
  nss: "NSS",
  direccion: "Dirección",
};

const INTEGRATION_TIPOS_CORRECCION = new Set([
  "nss",
  "cliente_ine_frente",
  "cliente_ine_reverso",
  "cliente_comprobante_domicilio",
  "cliente_estado_cuenta",
  "cliente_semanas_cotizadas",
  "cliente_acta_nacimiento",
  "cliente_constancia_sat",
  "ine",
  "estado_cuenta",
  "direccion",
]);

function isRetencionPrincipalTipo(tipo: string): boolean {
  return (
    tipo === "retencion_acuse_con_sello" ||
    tipo === "retencion_carta_sin_sello" ||
    tipo.startsWith("retencion_")
  );
}

function docLabel(tipo: string, labels: Record<string, string>): string {
  return labels[tipo] ?? ASESOR_CORRECCION_DOC_LABELS_DEFAULT[tipo] ?? tipo;
}

/**
 * Equivalente a `countAsesorCorreccionesAbiertas` / listado de elementos
 * que hoy usa el enrich frontend (DG rechazado, docs rechazados, retención).
 */
export function listAsesorCorreccionesAbiertas(
  input: AsesorCorreccionEnrichInput,
  documentLabels: Record<string, string> = ASESOR_CORRECCION_DOC_LABELS_DEFAULT,
): AsesorCorreccionItem[] {
  const items: AsesorCorreccionItem[] = [];

  if (input.clienteDatosEstado === "rechazado") {
    items.push({
      kind: "datos_generales",
      key: "datos_generales",
      label: "Datos generales",
    });
  }

  const seen = new Set<string>();
  for (const archivo of input.archivos ?? []) {
    const tipo = String(archivo.tipo_documento ?? "").trim();
    if (!tipo || seen.has(tipo)) continue;
    if (archivo.estatus_revision !== "rechazado") continue;
    const isRetencion = isRetencionPrincipalTipo(tipo);
    if (!INTEGRATION_TIPOS_CORRECCION.has(tipo) && !isRetencion) continue;
    seen.add(tipo);
    items.push({
      kind: isRetencion ? "acuse" : "documento",
      key: tipo,
      label: docLabel(tipo, documentLabels),
    });
  }

  if (
    input.retencionEnvioEstado === "correccion_requerida" &&
    !items.some((i) => i.kind === "acuse")
  ) {
    items.push({ kind: "acuse", key: "acuse", label: "Acuse" });
  }

  return items;
}

export function countAsesorCorreccionesAbiertas(
  input: AsesorCorreccionEnrichInput,
): number {
  return listAsesorCorreccionesAbiertas(input).length;
}

export function normalizeMesaCambioRequestType(
  value: string | null | undefined,
): MesaCambioRequestType | null {
  const v = (value ?? "").trim();
  if (
    v === "SOLICITUD_DATOS_GENERALES" ||
    v === "SOLICITUD_DOCUMENTAL" ||
    v === "RECHAZO_OPERATIVO_CON_CORRECCION"
  ) {
    return v;
  }
  return null;
}

/**
 * Items derivados SOLO del episodio P198 vigente (no histórico).
 * RECHAZO_OPERATIVO_CON_CORRECCION no debe presentarse como correccion_requerida
 * (contrato P204-A → rechazado_mesa); si llega aquí, se reporta como vacío
 * para forzar fallback + auditoría.
 */
export function listCorreccionItemsFromP198(
  meta: AsesorCorreccionP198Meta | null | undefined,
  documentLabels: Record<string, string> = ASESOR_CORRECCION_DOC_LABELS_DEFAULT,
): AsesorCorreccionItem[] {
  if (!meta) return [];
  const estado = String(meta.mesaCambioEstado ?? "").trim();
  if (estado && estado !== "WAITING_ADVISOR") return [];

  const requestType = normalizeMesaCambioRequestType(meta.requestType);
  if (!requestType) return [];

  if (requestType === "RECHAZO_OPERATIVO_CON_CORRECCION") {
    return [];
  }

  if (requestType === "SOLICITUD_DATOS_GENERALES") {
    return [
      {
        kind: "datos_generales",
        key: "datos_generales",
        label: "Datos generales",
      },
    ];
  }

  // SOLICITUD_DOCUMENTAL
  const kind = String(meta.documentKind ?? "").trim();
  if (!kind) {
    return [{ kind: "documento", key: "documento", label: "Documento" }];
  }
  const isRetencion = isRetencionPrincipalTipo(kind);
  return [
    {
      kind: isRetencion ? "acuse" : "documento",
      key: kind,
      label: docLabel(kind, documentLabels),
    },
  ];
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  const last = labels[labels.length - 1]!;
  return `${labels.slice(0, -1).join(", ")} e ${last}`;
}

/**
 * Copia de fila: siempre no vacía si estadoEfectivo === correccion_requerida.
 */
export function formatAsesorCorreccionInboxCopy(
  input: AsesorCorreccionCopyInput,
): string | null {
  const estado = String(input.estadoEfectivo ?? "").trim();
  if (estado !== "correccion_requerida") return null;

  const labels = input.documentLabels ?? ASESOR_CORRECCION_DOC_LABELS_DEFAULT;

  const enrichItems =
    input.enrichItems ??
    (input.enrich
      ? listAsesorCorreccionesAbiertas(input.enrich, labels)
      : []);

  if (enrichItems.length > 0) {
    return formatCorreccionItemsCopy(enrichItems);
  }

  const p198Items = listCorreccionItemsFromP198(input.p198, labels);
  if (p198Items.length > 0) {
    return formatCorreccionItemsCopy(p198Items);
  }

  return ASESOR_CORRECCION_FALLBACK_COPY;
}

export function formatCorreccionItemsCopy(
  items: AsesorCorreccionItem[],
): string {
  const labels = items.map((i) => i.label).filter(Boolean);
  if (labels.length === 0) return ASESOR_CORRECCION_FALLBACK_COPY;
  if (labels.length === 1) {
    return `Mesa solicita corregir: ${labels[0]}.`;
  }
  return `Mesa solicita corregir ${labels.length} elementos: ${joinLabels(labels)}.`;
}

/**
 * Clasifica si la UI actual (solo enrich count) puede explicar el motivo.
 * YES si count > 0; NO si estado=correccion_requerida y count=0.
 */
export function uiActualPuedeExplicarCorreccion(args: {
  estadoEfectivo?: string | null;
  enrichCount: number;
}): "YES" | "NO" | "N/A" {
  if (String(args.estadoEfectivo ?? "").trim() !== "correccion_requerida") {
    return "N/A";
  }
  return args.enrichCount > 0 ? "YES" : "NO";
}

/** Foco de detalle alineado al mismo episodio / items de presentación. */
export type AsesorCorreccionDetalleFocus =
  | { kind: "datos_generales" }
  | { kind: "documento"; tipo_documento: string }
  | { kind: "retencion" }
  | { kind: "fallback" };

export function resolveAsesorCorreccionDetalleFocus(
  input: AsesorCorreccionCopyInput,
): AsesorCorreccionDetalleFocus | null {
  const estado = String(input.estadoEfectivo ?? "").trim();
  if (estado !== "correccion_requerida") return null;

  const labels = input.documentLabels ?? ASESOR_CORRECCION_DOC_LABELS_DEFAULT;
  const enrichItems =
    input.enrichItems ??
    (input.enrich
      ? listAsesorCorreccionesAbiertas(input.enrich, labels)
      : []);
  const items =
    enrichItems.length > 0
      ? enrichItems
      : listCorreccionItemsFromP198(input.p198, labels);

  if (items.length === 0) return { kind: "fallback" };

  const first = items[0]!;
  if (first.kind === "datos_generales") return { kind: "datos_generales" };
  if (first.kind === "acuse" || first.kind === "retencion") {
    return { kind: "retencion" };
  }
  return { kind: "documento", tipo_documento: first.key };
}
