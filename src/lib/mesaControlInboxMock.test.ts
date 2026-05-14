import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeMesaControlInboxByLatestUpdated } from "./mesaControlInboxMock";

describe("mergeMesaControlInboxByLatestUpdated", () => {
  it("con dos filas mismo idPrecal, gana la de updatedAt más reciente", () => {
    const map = mergeMesaControlInboxByLatestUpdated([
      {
        idPrecal: "exp-1",
        subestado: "en_validacion_mesa",
        updatedAt: "2026-04-09T12:00:00.000Z",
        submittedToMesa: true,
      },
      {
        idPrecal: "exp-1",
        subestado: "pendiente",
        updatedAt: "2026-04-01T10:00:00.000Z",
        submittedToMesa: false,
      },
    ]);
    assert.equal(map.get("exp-1")?.subestado, "en_validacion_mesa");
    assert.equal(map.get("exp-1")?.submittedToMesa, true);
  });

  it("orden inverso en array: gana siempre el updatedAt más reciente", () => {
    const map = mergeMesaControlInboxByLatestUpdated([
      {
        idPrecal: "exp-1",
        subestado: "pendiente",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
      {
        idPrecal: "exp-1",
        subestado: "en_validacion_mesa",
        updatedAt: "2026-04-09T12:00:00.000Z",
      },
    ]);
    assert.equal(map.get("exp-1")?.subestado, "en_validacion_mesa");
  });
});
