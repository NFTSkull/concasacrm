import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asesorPuedeIntegrarTrasMontoRevisor,
  estatusPrecalificacionDesdeEditor,
} from "./mock.repo";

describe("asesorPuedeIntegrarTrasMontoRevisor", () => {
  it("true solo con aprobado y monto > 0", () => {
    assert.equal(
      asesorPuedeIntegrarTrasMontoRevisor({
        decision: "aprobado",
        monto_aprobado: 100,
        notas_revision: "",
      }),
      true,
    );
    assert.equal(
      asesorPuedeIntegrarTrasMontoRevisor({
        decision: "aprobado",
        monto_aprobado: 0,
        notas_revision: "",
      }),
      false,
    );
    assert.equal(
      asesorPuedeIntegrarTrasMontoRevisor({
        decision: "aprobado",
        monto_aprobado: null,
        notas_revision: "",
      }),
      false,
    );
    assert.equal(
      asesorPuedeIntegrarTrasMontoRevisor({
        decision: "pendiente",
        monto_aprobado: 100,
        notas_revision: "",
      }),
      false,
    );
  });
});

describe("estatusPrecalificacionDesdeEditor", () => {
  it("mapea decisión del editor", () => {
    assert.equal(
      estatusPrecalificacionDesdeEditor({
        decision: "pendiente",
        monto_aprobado: null,
        notas_revision: "",
      }),
      "pendiente",
    );
    assert.equal(
      estatusPrecalificacionDesdeEditor({
        decision: "no_cumple",
        monto_aprobado: null,
        notas_revision: "",
      }),
      "rechazado",
    );
    assert.equal(
      estatusPrecalificacionDesdeEditor({
        decision: "aprobado",
        monto_aprobado: null,
        notas_revision: "",
      }),
      "aprobado",
    );
  });
});
