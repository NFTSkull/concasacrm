import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etapaActualParaOperativo } from "./mock.repo";

describe("etapaActualParaOperativo", () => {
  it("fija etapa 2 cuando subestado es en_validacion_mesa (aunque el inbox tenga null o 1)", () => {
    assert.equal(etapaActualParaOperativo(null, "en_validacion_mesa"), 2);
    assert.equal(etapaActualParaOperativo(1, "en_validacion_mesa"), 2);
    assert.equal(etapaActualParaOperativo(2, "en_validacion_mesa"), 2);
  });

  it("no altera etapa cuando no está en validación mesa", () => {
    assert.equal(etapaActualParaOperativo(3, "en_proceso"), 3);
    assert.equal(etapaActualParaOperativo(null, "pendiente"), null);
    assert.equal(etapaActualParaOperativo(null, "en_proceso"), null);
  });
});
