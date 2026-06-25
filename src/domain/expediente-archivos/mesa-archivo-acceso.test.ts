import test from "node:test";
import assert from "node:assert/strict";
import { mesaPuedeAbrirArchivo } from "./mesa-archivo-acceso";

test("mesaPuedeAbrirArchivo: false sin id o faltante", () => {
  assert.equal(mesaPuedeAbrirArchivo(null), false);
  assert.equal(
    mesaPuedeAbrirArchivo({ id: null, estatus_revision: "faltante" }),
    false,
  );
  assert.equal(
    mesaPuedeAbrirArchivo({ id: "abc", estatus_revision: "faltante" }),
    false,
  );
});

test("mesaPuedeAbrirArchivo: true con id y estatus subido+", () => {
  assert.equal(
    mesaPuedeAbrirArchivo({ id: "abc", estatus_revision: "subido" }),
    true,
  );
  assert.equal(
    mesaPuedeAbrirArchivo({ id: "abc", estatus_revision: "validado" }),
    true,
  );
});
