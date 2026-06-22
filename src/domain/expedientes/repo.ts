import type { CreateExpedienteInput } from "./create-expediente.input";
import type { UpsertEditorDecisionInput } from "./upsert-editor-decision.input";
import type { ExpedienteMock } from "./mock.repo";

/** Contrato expedientes — lectura admin/asesor/detalle (P3B/P3D) + creación asesor (P3C) + envío Mesa (P3E) + editor (P3F). */
export interface ExpedientesRepo {
  listForAdmin(): Promise<ExpedienteMock[]>;
  listForAsesor(asesorEmail: string): Promise<ExpedienteMock[]>;
  listForEditor(): Promise<ExpedienteMock[]>;
  getById(id: string): Promise<ExpedienteMock | null>;
  createExpediente(input: CreateExpedienteInput): Promise<ExpedienteMock>;
  enviarAMesa(expedienteId: string): Promise<ExpedienteMock>;
  upsertEditorDecision(
    expedienteId: string,
    input: UpsertEditorDecisionInput,
  ): Promise<ExpedienteMock>;
}
