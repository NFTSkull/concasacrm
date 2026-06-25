import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEnviarRetencionMesaRpcError } from "./enviar-retencion-mesa-rpc-error";
import {
  mapSupabaseRetencionEnvioRow,
  mapSupabaseRetencionOpcionRow,
} from "./supabase.repo";

describe("mapEnviarRetencionMesaRpcError", () => {
  it("mapea bloque ya enviado", () => {
    const err = mapEnviarRetencionMesaRpcError({
      message: "enviar_retencion_mesa: bloque ya enviado a Mesa",
    });
    assert.match(err.message, /ya fue enviado/i);
  });

  it("mapea documento rechazado", () => {
    const err = mapEnviarRetencionMesaRpcError({
      message:
        "enviar_retencion_mesa: documento retencion_aviso_retencion rechazado; reemplazar antes de enviar",
    });
    assert.match(err.message, /rechazados/i);
  });

  it("mapea falta documento", () => {
    const err = mapEnviarRetencionMesaRpcError({
      message: "enviar_retencion_mesa: falta documento retencion_ine_frente",
    });
    assert.match(err.message, /Faltan documentos/i);
  });
});

describe("mapSupabaseRetencion rows", () => {
  it("mapea opción", () => {
    const row = mapSupabaseRetencionOpcionRow({
      expediente_id: "e1",
      retencion_opcion: "sin_sello",
      updated_at: "2026-06-25T10:00:00Z",
    });
    assert.equal(row.expedienteId, "e1");
    assert.equal(row.retencion_opcion, "sin_sello");
  });

  it("mapea envío", () => {
    const row = mapSupabaseRetencionEnvioRow({
      expediente_id: "e1",
      enviado: true,
      fecha_envio_mesa: "2026-06-25T11:00:00Z",
      opcion: "con_sello",
      estado: "enviado",
    });
    assert.equal(row.opcion, "con_sello");
    assert.equal(row.estado, "enviado");
    assert.equal(row.enviado, true);
  });
});
