import { getAgendaBiometricosDisponibilidad, isSlotBookable } from "./availability";
import type {
  AgendaBiometricosBookingsV1,
  AgendaBiometricosBookingV1,
  AgendaBiometricosConfigV1,
  AgendaBiometricosLocationId,
  HhmmTime,
  YmdDate,
} from "./types";

/**
 * Marca como `cancelled` todas las reservas `booked` del expediente (no elimina filas).
 */
export function cancelActiveBookingsForExpediente(
  bookings: AgendaBiometricosBookingsV1,
  expedienteId: string,
  updatedAt: string,
): AgendaBiometricosBookingsV1 {
  let touched = false;
  const nextList = bookings.bookings.map((b) => {
    if (b.expedienteId === expedienteId && b.status === "booked") {
      touched = true;
      return { ...b, status: "cancelled" as const };
    }
    return b;
  });
  return {
    ...bookings,
    updatedAt: touched ? updatedAt : bookings.updatedAt,
    bookings: nextList,
  };
}

export type PlanBookBiometricosSlotResult =
  | {
      ok: true;
      nextBookings: AgendaBiometricosBookingsV1;
      nuevaReserva: AgendaBiometricosBookingV1;
    }
  | { ok: false; error: string };

/**
 * En memoria: cancela `booked` previas del expediente, valida cupo en el slot objetivo
 * y devuelve el documento de bookings con una nueva fila `booked`.
 */
export function planBookBiometricosSlot(params: {
  config: AgendaBiometricosConfigV1;
  bookings: AgendaBiometricosBookingsV1;
  expedienteId: string;
  date: YmdDate;
  time: HhmmTime;
  locationId: AgendaBiometricosLocationId;
  bookingId: string;
  createdBy: AgendaBiometricosBookingV1["createdBy"];
  note: string | null;
  nowIso: string;
}): PlanBookBiometricosSlotResult {
  const cancelled = cancelActiveBookingsForExpediente(
    params.bookings,
    params.expedienteId,
    params.nowIso,
  );
  const availability = getAgendaBiometricosDisponibilidad({
    config: params.config,
    bookings: cancelled,
    date: params.date,
    locationId: params.locationId,
  });
  if (!isSlotBookable({ availability, time: params.time })) {
    return {
      ok: false,
      error: "Ese horario ya no tiene cupo disponible. Elige otro horario.",
    };
  }
  const nuevaReserva: AgendaBiometricosBookingV1 = {
    id: params.bookingId,
    expedienteId: params.expedienteId,
    date: params.date,
    locationId: params.locationId,
    time: params.time,
    status: "booked",
    createdAt: params.nowIso,
    createdBy: params.createdBy,
    note: params.note,
  };
  return {
    ok: true,
    nextBookings: {
      ...cancelled,
      updatedAt: params.nowIso,
      bookings: [...cancelled.bookings, nuevaReserva],
    },
    nuevaReserva,
  };
}
