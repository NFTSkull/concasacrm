import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapUpdateDocumentoRevisionRpcError } from "./update-documento-revision-rpc-error";

describe("mapUpdateDocumentoRevisionRpcError", () => {
  it("mapea rol no autorizado", () => {
    const err = mapUpdateDocumentoRevisionRpcError({
      code: "42501",
      message: "update_documento_revision: rol no autorizado (asesor)",
    });
    assert.match(err.message, /Solo Mesa de control/);
  });

  it("mapea comentario obligatorio al rechazar", () => {
    const err = mapUpdateDocumentoRevisionRpcError({
      code: "22023",
      message: "update_documento_revision: comentario_mesa es obligatorio al rechazar",
    });
    assert.match(err.message, /motivo de rechazo/);
  });

  it("mapea documento no encontrado", () => {
    const err = mapUpdateDocumentoRevisionRpcError({
      code: "P0002",
      message: "update_documento_revision: documento no encontrado",
    });
    assert.match(err.message, /no encontrado/);
  });
});
