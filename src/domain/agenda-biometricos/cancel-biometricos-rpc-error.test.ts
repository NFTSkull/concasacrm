import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapCancelBiometricosRpcError } from "./cancel-biometricos-rpc-error";

describe("mapCancelBiometricosRpcError", () => {
  it("mapea sin cita activa", () => {
    const err = mapCancelBiometricosRpcError({
      message: "cancel_biometricos: no hay cita biométrica activa para cancelar",
    });
    assert.match(err.message, /no hay una cita biométrica activa/i);
  });

  it("mapea etapa incorrecta", () => {
    const err = mapCancelBiometricosRpcError({
      message: "cancel_biometricos: solo se puede cancelar en etapa 4 (actual: 5)",
    });
    assert.match(err.message, /etapa 4/i);
  });

  it("mapea asesor no dueño", () => {
    const err = mapCancelBiometricosRpcError({
      message: "cancel_biometricos: solo el asesor dueño puede cancelar biométricos",
    });
    assert.match(err.message, /asesor dueño/i);
  });

  it("mapea rol no autorizado", () => {
    const err = mapCancelBiometricosRpcError({
      message: "cancel_biometricos: rol no autorizado (mesa_admin)",
    });
    assert.match(err.message, /permiso para cancelar/i);
  });
});
