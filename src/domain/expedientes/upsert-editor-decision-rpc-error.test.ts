import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapUpsertEditorDecisionRpcError } from "./upsert-editor-decision-rpc-error";
import { ExpedientesSupabaseError } from "./supabase.error";

describe("mapUpsertEditorDecisionRpcError", () => {
  it("mapea rol no autorizado", () => {
    const err = mapUpsertEditorDecisionRpcError({
      message: "upsert_editor_decision: rol no autorizado (asesor)",
    });
    assert.ok(err instanceof ExpedientesSupabaseError);
    assert.match(err.message, /solo un editor/i);
  });

  it("mapea monto obligatorio en aprobado", () => {
    const err = mapUpsertEditorDecisionRpcError({
      message:
        "upsert_editor_decision: monto_aprobado es obligatorio cuando decision = aprobado",
    });
    assert.match(err.message, /monto aprobado es obligatorio/i);
  });

  it("mapea monto debe ser mayor a 0", () => {
    const err = mapUpsertEditorDecisionRpcError({
      message: "upsert_editor_decision: monto_aprobado debe ser mayor a 0",
    });
    assert.match(err.message, /mayor a cero/i);
  });

  it("mapea ya enviado a mesa", () => {
    const err = mapUpsertEditorDecisionRpcError({
      message:
        "upsert_editor_decision: no se puede editar decisión tras enviar a Mesa",
    });
    assert.match(err.message, /después de enviar el expediente a Mesa/i);
  });

  it("mapea no autorizado por código 42501", () => {
    const err = mapUpsertEditorDecisionRpcError({
      code: "42501",
      message: "permission denied",
    });
    assert.match(err.message, /permiso/i);
  });

  it("mapea expediente no encontrado", () => {
    const err = mapUpsertEditorDecisionRpcError({
      code: "P0002",
      message: "upsert_editor_decision: expediente no encontrado",
    });
    assert.match(err.message, /no encontrado/i);
  });

  it("mapea error inesperado", () => {
    const err = mapUpsertEditorDecisionRpcError({
      message: "algo desconocido",
    });
    assert.match(err.message, /no se pudo guardar la decisión/i);
  });
});
