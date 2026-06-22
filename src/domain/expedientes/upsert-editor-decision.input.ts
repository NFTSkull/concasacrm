import type { EditorDecision } from "./mock.repo";

/** Entrada para `upsertEditorDecision` (RPC `upsert_editor_decision`). */
export type UpsertEditorDecisionInput = {
  decision: EditorDecision;
  monto_aprobado: number | null;
  notas_revision?: string;
};
