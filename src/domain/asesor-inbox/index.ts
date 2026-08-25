export {
  ASESOR_CORRECCION_DOC_LABELS_DEFAULT,
  ASESOR_CORRECCION_FALLBACK_COPY,
  countAsesorCorreccionesAbiertas,
  formatAsesorCorreccionInboxCopy,
  formatCorreccionItemsCopy,
  listAsesorCorreccionesAbiertas,
  listCorreccionItemsFromP198,
  normalizeMesaCambioRequestType,
  resolveAsesorCorreccionDetalleFocus,
  uiActualPuedeExplicarCorreccion,
} from "./correccion-motivo";
export type {
  AsesorCorreccionCopyInput,
  AsesorCorreccionDetalleFocus,
  AsesorCorreccionEnrichInput,
  AsesorCorreccionItem,
  AsesorCorreccionItemKind,
  AsesorCorreccionP198Meta,
  MesaCambioEstadoEfectivo,
  MesaCambioRequestType,
} from "./correccion-motivo";
