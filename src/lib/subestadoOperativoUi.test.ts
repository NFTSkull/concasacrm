import test from "node:test";
import assert from "node:assert/strict";
import {
  subestadoOperativoBadgeClass,
  subestadoOperativoLabel,
} from "./subestadoOperativoUi";

test("subestadoOperativoLabel: en_validacion_mesa", () => {
  assert.equal(subestadoOperativoLabel("en_validacion_mesa"), "En validación por mesa");
  assert.equal(subestadoOperativoLabel(" en_validacion_mesa "), "En validación por mesa");
});

test("subestadoOperativoLabel: null → Pendiente", () => {
  assert.equal(subestadoOperativoLabel(null), "Pendiente");
});

test("subestadoOperativoBadgeClass: en_validacion_mesa alto contraste", () => {
  const c = subestadoOperativoBadgeClass("en_validacion_mesa");
  assert.ok(c.includes("bg-blue-600"));
  assert.ok(c.includes("text-white"));
  assert.ok(!c.includes("green-"));
});
