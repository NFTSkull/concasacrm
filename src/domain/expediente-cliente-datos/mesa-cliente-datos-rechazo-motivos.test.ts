import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildComentarioRechazoClienteDatos } from "./mesa-cliente-datos-rechazo-motivos";

describe("buildComentarioRechazoClienteDatos", () => {
  it("usa motivo sugerido", () => {
    assert.equal(buildComentarioRechazoClienteDatos("RFC incorrecto", ""), "RFC incorrecto");
  });

  it("con Otro exige texto manual", () => {
    assert.equal(buildComentarioRechazoClienteDatos("Otro", ""), null);
    assert.equal(
      buildComentarioRechazoClienteDatos("Otro", "CURP no coincide con INE"),
      "CURP no coincide con INE",
    );
  });
});
