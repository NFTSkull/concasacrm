import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildComentarioRechazoDocumento } from "./mesa-rechazo-motivos";

describe("buildComentarioRechazoDocumento", () => {
  it("usa motivo sugerido directo", () => {
    assert.equal(
      buildComentarioRechazoDocumento("Imagen borrosa", ""),
      "Imagen borrosa",
    );
  });

  it("con Otro exige texto manual", () => {
    assert.equal(buildComentarioRechazoDocumento("Otro", ""), null);
    assert.equal(
      buildComentarioRechazoDocumento("Otro", "Falta firma del cliente"),
      "Falta firma del cliente",
    );
  });
});
