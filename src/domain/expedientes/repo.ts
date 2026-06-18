import type { ExpedienteMock } from "./mock.repo";

/** Contrato mínimo P3B.1 — lectura admin; se extiende en fases posteriores. */
export interface ExpedientesRepo {
  listForAdmin(): Promise<ExpedienteMock[]>;
}
