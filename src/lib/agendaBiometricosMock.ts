/**
 * Agenda biométricos (mock) – fuente única de verdad:
 * - Config: localStorage `agenda_config_v1`
 * - Reservas: localStorage `agenda_bookings_v1`
 *
 * IMPORTANTE: este módulo ya NO usa `mesa_control_inbox` para disponibilidad/ocupación.
 */

import {
  cancelActiveBookingsForExpediente,
  computeMinBookableDateYmd,
  getAgendaBiometricosDisponibilidad,
  isSlotBookable,
  MockAgendaBiometricosLocalStorageRepo,
  planBookBiometricosSlot,
  type AgendaBiometricosBookingV1,
  type AgendaBiometricosBookingActorRole,
  type AgendaBiometricosLocationId,
  type HhmmTime,
  type YmdDate,
} from "@/domain/agenda-biometricos";
import { getEffectiveMockRole } from "@/lib/mockUser";

/** Clave estable minuto a minuto en hora local (para colisiones). */
export function slotKeyFromFechaCita(isoOrDate: string): string | null {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function isWeekdayDate(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function ensureConfigOrThrow() {
  const repo = new MockAgendaBiometricosLocalStorageRepo();
  const config = repo.readConfig();
  if (!config) {
    throw new Error(
      "Agenda de biométricos no configurada (falta agenda_config_v1). Pide a mesa de control admin que configure horarios/cupos."
    );
  }
  return { repo, config };
}

export function getAvailableTimeLabelsForDate(
  dateYmd: YmdDate,
  locationId: AgendaBiometricosLocationId,
  excludeExpedienteId?: string,
): string[] {
  const { repo, config } = ensureConfigOrThrow();
  const bookings = repo.readBookings();
  const availability = getAgendaBiometricosDisponibilidad({
    config,
    bookings,
    date: dateYmd,
    locationId,
    excludeExpedienteId,
  });
  return availability.filter((a) => a.remaining > 0).map((a) => a.time);
}

export function buildLocalIsoFromDateAndTime(
  dateYmd: YmdDate,
  timeHhmm: HhmmTime,
): string | null {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHhmm.split(":").map(Number);
  if (!y || !mo || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const dt = new Date(y, mo - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function validateSlotForBooking(
  dateYmd: YmdDate,
  timeHhmm: HhmmTime,
  locationId: AgendaBiometricosLocationId,
  excludeExpedienteId?: string,
): { ok: true; iso: string; key: string } | { ok: false; error: string } {
  const iso = buildLocalIsoFromDateAndTime(dateYmd, timeHhmm);
  if (!iso) return { ok: false, error: "Hora no válida." };
  const key = slotKeyFromFechaCita(iso);
  if (!key) return { ok: false, error: "No se pudo validar el horario." };
  try {
    const { repo, config } = ensureConfigOrThrow();
    const bookings = repo.readBookings();
    const availability = getAgendaBiometricosDisponibilidad({
      config,
      bookings,
      date: dateYmd,
      locationId,
      excludeExpedienteId,
    });
    const ok = isSlotBookable({ availability, time: timeHhmm });
    if (!ok) {
      return { ok: false, error: "Ese horario no está disponible según la agenda configurada." };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo validar la agenda.",
    };
  }
  return { ok: true, iso, key };
}

export function getNextAvailableSlotHints(
  excludeExpedienteId: string | undefined,
  locationId: AgendaBiometricosLocationId,
  max: number,
  maxDaysScan = 21,
): Array<{ dateYmd: string; label: string; display: string }> {
  const { repo, config } = ensureConfigOrThrow();
  const bookings = repo.readBookings();
  const hints: Array<{ dateYmd: string; label: string; display: string }> = [];
  const minYmd = computeMinBookableDateYmd(new Date(), config.rules);
  const start = new Date();
  const [y, mo, d] = minYmd.split("-").map(Number);
  start.setFullYear(y, mo - 1, d);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < maxDaysScan && hints.length < max; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateYmd = `${y}-${m}-${day}` as YmdDate;
    const availability = getAgendaBiometricosDisponibilidad({
      config,
      bookings,
      date: dateYmd,
      locationId,
      excludeExpedienteId,
    });
    const free = availability.filter((a) => a.remaining > 0).map((a) => a.time);
    for (const lab of free) {
      if (hints.length >= max) break;
      hints.push({
        dateYmd,
        label: lab,
        display: `${dateYmd} · ${lab}`,
      });
    }
  }
  return hints;
}

function newBookingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Actor mock desde `localStorage` (misma convención que el resto del CRM mock). */
export function readMockBookingActor(): AgendaBiometricosBookingV1["createdBy"] {
  if (typeof window === "undefined") {
    return { email: "system@local", role: "mesa_control_admin" };
  }
  const email = window.localStorage.getItem("mock_email")?.trim() || "unknown@local";
  const roleRaw = getEffectiveMockRole();
  let role: AgendaBiometricosBookingActorRole = "mesa_control_admin";
  if (roleRaw === "asesor") role = "asesor";
  else if (
    roleRaw === "mesa_control" ||
    roleRaw === "mesa_control_interno" ||
    roleRaw === "mesa_control_externo"
  ) {
    role = "mesa_control";
  }
  return { email, role };
}

export type TryWriteBiometricosBookingResult =
  | { ok: true; rollback: () => void }
  | { ok: false; error: string };

/**
 * Persiste `agenda_bookings_v1`: cancela `booked` previas del expediente y agrega una nueva.
 * Devuelve `rollback` para restaurar el snapshot previo si falla otra persistencia (p. ej. inbox).
 */
export function tryWriteBiometricosBooking(params: {
  expedienteId: string;
  dateYmd: YmdDate;
  timeHhmm: HhmmTime;
  locationId: AgendaBiometricosLocationId;
}): TryWriteBiometricosBookingResult {
  const repo = new MockAgendaBiometricosLocalStorageRepo();
  const config = repo.readConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "Agenda de biométricos no configurada (falta agenda_config_v1). Pide a mesa de control admin que configure horarios/cupos.",
    };
  }
  const prev = repo.readBookings();
  const nowIso = new Date().toISOString();
  const planned = planBookBiometricosSlot({
    config,
    bookings: prev,
    expedienteId: params.expedienteId,
    date: params.dateYmd,
    time: params.timeHhmm,
    locationId: params.locationId,
    bookingId: newBookingId(),
    createdBy: readMockBookingActor(),
    note: null,
    nowIso,
  });
  if (!planned.ok) return planned;
  repo.writeBookings(planned.nextBookings);
  return {
    ok: true,
    rollback: () => {
      repo.writeBookings(prev);
    },
  };
}

/** Cancela en `localStorage` todas las reservas `booked` del expediente (p. ej. rechazo mesa). */
export function cancelBiometricosBookingsForExpediente(expedienteId: string): void {
  const repo = new MockAgendaBiometricosLocalStorageRepo();
  const nowIso = new Date().toISOString();
  const next = cancelActiveBookingsForExpediente(repo.readBookings(), expedienteId, nowIso);
  repo.writeBookings(next);
}
