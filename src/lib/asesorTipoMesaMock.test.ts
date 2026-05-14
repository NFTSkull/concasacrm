import test from "node:test";
import assert from "node:assert/strict";
import { getTipoAsesorForEmail, origenMesaDesdeEmailAsesor } from "./asesorTipoMesaMock";

test("sin catálogo ni window: default interno", () => {
  assert.equal(getTipoAsesorForEmail("cualquiera@test.com"), "interno");
  assert.equal(origenMesaDesdeEmailAsesor(undefined), "interno");
});
