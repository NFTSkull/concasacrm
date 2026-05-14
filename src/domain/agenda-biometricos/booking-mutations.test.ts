import test from "node:test";
import assert from "node:assert/strict";
import {
  cancelActiveBookingsForExpediente,
  planBookBiometricosSlot,
} from "./booking-mutations";
import type { AgendaBiometricosBookingsV1, AgendaBiometricosConfigV1 } from "./types";

const baseConfig: AgendaBiometricosConfigV1 = {
  version: 1,
  kind: "biometricos",
  updatedAt: "2026-04-20T00:00:00.000Z",
  updatedBy: { email: "cynthia@test", role: "mesa_control_admin" },
  locations: [
    { id: "monterrey", label: "Monterrey", tz: "America/Monterrey" },
    { id: "apodaca", label: "Apodaca", tz: "America/Monterrey" },
  ],
  rules: { minLeadDays: 0, afterTimeLocal: "14:30", minLeadDaysAfterCutoff: 0 },
  days: {
    "2026-04-23": {
      monterrey: { slots: [{ time: "08:30", capacity: 1 }] },
    },
  },
};

const emptyBookings: AgendaBiometricosBookingsV1 = {
  version: 1,
  kind: "biometricos",
  updatedAt: "2026-04-20T00:00:00.000Z",
  bookings: [],
};

test("cancelActiveBookingsForExpediente marca booked como cancelled", () => {
  const bookings: AgendaBiometricosBookingsV1 = {
    ...emptyBookings,
    bookings: [
      {
        id: "a",
        expedienteId: "e1",
        date: "2026-04-23",
        locationId: "monterrey",
        time: "08:30",
        status: "booked",
        createdAt: "t0",
        createdBy: { email: "x", role: "asesor" },
        note: null,
      },
    ],
  };
  const out = cancelActiveBookingsForExpediente(bookings, "e1", "t1");
  assert.equal(out.bookings[0].status, "cancelled");
});

test("planBookBiometricosSlot: segunda reserva en mismo slot falla (cupo 1)", () => {
  const first = planBookBiometricosSlot({
    config: baseConfig,
    bookings: emptyBookings,
    expedienteId: "e1",
    date: "2026-04-23",
    time: "08:30",
    locationId: "monterrey",
    bookingId: "b1",
    createdBy: { email: "a@t", role: "asesor" },
    note: null,
    nowIso: "t0",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = planBookBiometricosSlot({
    config: baseConfig,
    bookings: first.nextBookings,
    expedienteId: "e2",
    date: "2026-04-23",
    time: "08:30",
    locationId: "monterrey",
    bookingId: "b2",
    createdBy: { email: "b@t", role: "asesor" },
    note: null,
    nowIso: "t1",
  });
  assert.equal(second.ok, false);
});

test("planBookBiometricosSlot: reagenda mismo expediente libera cupo y vuelve a reservar", () => {
  const r1 = planBookBiometricosSlot({
    config: baseConfig,
    bookings: emptyBookings,
    expedienteId: "e1",
    date: "2026-04-23",
    time: "08:30",
    locationId: "monterrey",
    bookingId: "b1",
    createdBy: { email: "a@t", role: "asesor" },
    note: null,
    nowIso: "t0",
  });
  assert.equal(r1.ok, true);
  if (!r1.ok) return;
  const r2 = planBookBiometricosSlot({
    config: baseConfig,
    bookings: r1.nextBookings,
    expedienteId: "e1",
    date: "2026-04-23",
    time: "08:30",
    locationId: "monterrey",
    bookingId: "b2",
    createdBy: { email: "a@t", role: "asesor" },
    note: null,
    nowIso: "t1",
  });
  assert.equal(r2.ok, true);
  if (!r2.ok) return;
  const booked = r2.nextBookings.bookings.filter((b) => b.status === "booked");
  assert.equal(booked.length, 1);
  assert.equal(booked[0].id, "b2");
  const cancelled = r2.nextBookings.bookings.filter((b) => b.status === "cancelled");
  assert.equal(cancelled.length, 1);
});
