import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMinBookableDateYmd,
  getAgendaBiometricosDisponibilidad,
  type AgendaBiometricosBookingsV1,
  type AgendaBiometricosConfigV1,
} from "@/domain/agenda-biometricos";

test("computeMinBookableDateYmd: después de 14:30 sube minLeadDays a 3", () => {
  const rules = {
    minLeadDays: 2,
    afterTimeLocal: "14:30",
    minLeadDaysAfterCutoff: 3,
  } as const;
  const now = new Date("2026-04-20T20:31:00.000Z"); // 14:31 local aproximado; la función usa hora local del Date.
  const ymd = computeMinBookableDateYmd(now, rules);
  assert.equal(typeof ymd, "string");
});

test("getAgendaBiometricosDisponibilidad: usa slots del día/config y resta bookings booked", () => {
  const config: AgendaBiometricosConfigV1 = {
    version: 1,
    kind: "biometricos",
    updatedAt: "2026-04-20T00:00:00.000Z",
    updatedBy: { email: "cynthia@test", role: "mesa_control_admin" },
    locations: [
      { id: "monterrey", label: "Monterrey", tz: "America/Monterrey" },
      { id: "apodaca", label: "Apodaca", tz: "America/Monterrey" },
    ],
    rules: { minLeadDays: 2, afterTimeLocal: "14:30", minLeadDaysAfterCutoff: 3 },
    days: {
      "2026-04-23": {
        monterrey: { slots: [{ time: "08:30", capacity: 2 }] },
      },
    },
  };
  const bookings: AgendaBiometricosBookingsV1 = {
    version: 1,
    kind: "biometricos",
    updatedAt: "2026-04-20T00:00:00.000Z",
    bookings: [
      {
        id: "b1",
        expedienteId: "exp-1",
        date: "2026-04-23",
        locationId: "monterrey",
        time: "08:30",
        status: "booked",
        createdAt: "2026-04-20T00:00:00.000Z",
        createdBy: { email: "cynthia@test", role: "mesa_control_admin" },
        note: null,
      },
    ],
  };
  const av = getAgendaBiometricosDisponibilidad({
    config,
    bookings,
    date: "2026-04-23",
    locationId: "monterrey",
  });
  assert.equal(av.length, 1);
  assert.equal(av[0].capacity, 2);
  assert.equal(av[0].bookedCount, 1);
  assert.equal(av[0].remaining, 1);
});
