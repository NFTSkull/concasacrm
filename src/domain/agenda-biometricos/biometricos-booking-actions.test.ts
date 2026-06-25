import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canShowBiometricosManageActions } from "./biometricos-booking-actions";

describe("canShowBiometricosManageActions", () => {
  it("muestra acciones en etapa 4 con booking activo", () => {
    assert.equal(
      canShowBiometricosManageActions({ etapaActual: 4, hasActiveBooking: true }),
      true,
    );
  });

  it("oculta acciones en etapa 5", () => {
    assert.equal(
      canShowBiometricosManageActions({ etapaActual: 5, hasActiveBooking: true }),
      false,
    );
  });

  it("oculta acciones sin booking activo", () => {
    assert.equal(
      canShowBiometricosManageActions({ etapaActual: 4, hasActiveBooking: false }),
      false,
    );
  });

  it("oculta acciones en etapa 3", () => {
    assert.equal(
      canShowBiometricosManageActions({ etapaActual: 3, hasActiveBooking: true }),
      false,
    );
  });
});
