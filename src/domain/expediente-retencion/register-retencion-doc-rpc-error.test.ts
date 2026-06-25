import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapRegisterRetencionDocRpcError } from "./register-retencion-doc-rpc-error";

describe("mapRegisterRetencionDocRpcError", () => {
  it("mapea etapa 8", () => {
    const err = mapRegisterRetencionDocRpcError({
      message: "register_expediente_documento_retencion: expediente debe estar en etapa 8 (actual: 7)",
    });
    assert.match(err.message, /etapa 8/i);
  });

  it("mapea documento validado", () => {
    const err = mapRegisterRetencionDocRpcError({
      message:
        "register_expediente_documento_retencion: documento validado; Mesa debe rechazarlo antes de reemplazar",
    });
    assert.match(err.message, /aceptado por Mesa/i);
  });

  it("mapea expediente no enviado a Mesa", () => {
    const err = mapRegisterRetencionDocRpcError({
      message:
        "register_expediente_documento_retencion: el expediente aún no fue enviado a Mesa",
    });
    assert.match(err.message, /enviado a Mesa/i);
  });
});
