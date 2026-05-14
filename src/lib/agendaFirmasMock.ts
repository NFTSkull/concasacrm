"use client";

import type { HhmmTime, YmdDate } from "@/domain/agenda-biometricos";
import {
  AGENDA_FIRMAS_CONFIG_KEY_V1,
  AGENDA_FIRMAS_BOOKINGS_KEY_V1,
  readFirmasBookingsDoc,
  type FirmasBookingRow,
} from "@/lib/agendaFirmasBookingsGuard";
import { getEffectiveMockRole } from "@/lib/mockUser";

export type AgendaFirmasConfigSlot = Readonly<{
  time: HhmmTime;
  capacity: number;
  active?: boolean;
}>;

export type AgendaFirmasConfigV1 = Readonly<{
  version: 1;
  kind: "firmas";
  updatedAt: string;
  updatedBy: Readonly<{ email: string; role: "mesa_control_admin" }>;
  locations: readonly Readonly<{
    id: string;
    label: string;
    tz: "America/Monterrey";
    active?: boolean;
  }>[];
  rules: Readonly<{
    minLeadDays: number;
    afterTimeLocal: HhmmTime;
    minLeadDaysAfterCutoff: number;
  }>;
  days: Readonly<
    Record<
      YmdDate,
      | Readonly<{
          [locationId: string]: Readonly<{ slots: readonly AgendaFirmasConfigSlot[] }> | undefined;
        }>
      | undefined
    >
  >;
}>;

export type AgendaFirmasBookingsDocV1 = Readonly<{
  version: 1;
  kind: "firmas";
  updatedAt: string;
  bookings: readonly FirmasBookingRow[];
}>;

export type AgendaFirmasSlotAvailability = Readonly<{
  date: YmdDate;
  locationId: string;
  time: HhmmTime;
  capacity: number;
  bookedCount: number;
  remaining: number;
}>;

function newBookingId(): string {
  return `firmas_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function toInt(n: number): number {
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isConfigV1(v: unknown): v is AgendaFirmasConfigV1 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && o.kind === "firmas";
}

export function readAgendaFirmasConfig(): AgendaFirmasConfigV1 | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParseJson(window.localStorage.getItem(AGENDA_FIRMAS_CONFIG_KEY_V1));
  return isConfigV1(parsed) ? parsed : null;
}

export function writeAgendaFirmasConfig(next: AgendaFirmasConfigV1): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENDA_FIRMAS_CONFIG_KEY_V1, JSON.stringify(next));
  window.dispatchEvent(new Event("agenda_firmas_config_updated"));
}

export function readAgendaFirmasBookings(): AgendaFirmasBookingsDocV1 {
  if (typeof window === "undefined") {
    return { version: 1, kind: "firmas", updatedAt: new Date().toISOString(), bookings: [] };
  }
  const doc = readFirmasBookingsDoc();
  const list = Array.isArray(doc.bookings) ? doc.bookings : [];
  return {
    version: 1,
    kind: "firmas",
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : new Date().toISOString(),
    bookings: list,
  };
}

export function writeAgendaFirmasBookings(next: AgendaFirmasBookingsDocV1): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    AGENDA_FIRMAS_BOOKINGS_KEY_V1,
    JSON.stringify({
      version: 1,
      kind: "agenda_firmas_bookings_v1",
      updatedAt: next.updatedAt,
      bookings: next.bookings,
    }),
  );
  window.dispatchEvent(new Event("agenda_firmas_bookings_v1_updated"));
}

function countBookedForSlot(params: {
  bookings: readonly FirmasBookingRow[];
  date: YmdDate;
  locationId: string;
  time: HhmmTime;
  excludeExpedienteId?: string;
}): number {
  const { bookings, date, locationId, time, excludeExpedienteId } = params;
  let count = 0;
  for (const b of bookings) {
    if (b.status !== "booked") continue;
    if (b.date !== date) continue;
    if (b.locationId !== locationId) continue;
    if (b.time !== time) continue;
    if (excludeExpedienteId && String(b.expedienteId ?? "").trim() === excludeExpedienteId) continue;
    count += 1;
  }
  return count;
}

export function getAgendaFirmasDisponibilidad(params: {
  config: AgendaFirmasConfigV1;
  bookings: readonly FirmasBookingRow[];
  date: YmdDate;
  locationId: string;
  excludeExpedienteId?: string;
}): AgendaFirmasSlotAvailability[] {
  const { config, bookings, date, locationId, excludeExpedienteId } = params;
  const locationMeta = config.locations.find((l) => l.id === locationId);
  if (locationMeta?.active === false) return [];
  const slots = (config.days[date]?.[locationId]?.slots ?? []).filter((s) => s.active !== false);
  return slots.map((s) => {
    const capacity = Math.max(0, toInt(s.capacity));
    const bookedCount = countBookedForSlot({
      bookings,
      date,
      locationId,
      time: s.time,
      excludeExpedienteId,
    });
    return {
      date,
      locationId,
      time: s.time,
      capacity,
      bookedCount,
      remaining: Math.max(0, capacity - bookedCount),
    };
  });
}

export function getAvailableFirmaTimeLabelsForDate(
  dateYmd: YmdDate,
  locationId: string,
  excludeExpedienteId?: string,
): string[] {
  const config = readAgendaFirmasConfig();
  if (!config) return [];
  const bookings = readAgendaFirmasBookings();
  return getAgendaFirmasDisponibilidad({
    config,
    bookings: bookings.bookings,
    date: dateYmd,
    locationId,
    excludeExpedienteId,
  })
    .filter((s) => s.remaining > 0)
    .map((s) => s.time);
}

export type TryWriteFirmasBookingResult =
  | { ok: true; iso: string; rollback: () => void }
  | { ok: false; error: string };

/**
 * Persiste `agenda_firmas_bookings_v1`: cancela `booked` previas del expediente y agrega una nueva.
 * Valida cupo disponible según `agenda_firmas_config_v1`.
 */
export function tryWriteFirmasBooking(params: {
  expedienteId: string;
  dateYmd: YmdDate;
  timeHhmm: HhmmTime;
  locationId: string;
}): TryWriteFirmasBookingResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "Solo disponible en el navegador." };
  }
  const role = getEffectiveMockRole();
  if (!(role === "mesa_control_admin" || role === "asesor" || role === "mesa_control")) {
    return {
      ok: false,
      error: "Rol no autorizado para reservar cita de firma.",
    };
  }
  const config = readAgendaFirmasConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "Agenda de firmas no configurada (falta agenda_firmas_config_v1). Pide a mesa de control admin que configure horarios/cupos.",
    };
  }
  const doc = readAgendaFirmasBookings();
  const prev = [...doc.bookings];
  const expedienteId = String(params.expedienteId).trim();
  const nowIso = new Date().toISOString();
  const actorEmail = window.localStorage.getItem("mock_email")?.trim() || "unknown@local";
  const currentActive = prev.find(
    (b) => String(b.expedienteId ?? "").trim() === expedienteId && b.status === "booked",
  );
  if (
    currentActive &&
    currentActive.date === params.dateYmd &&
    currentActive.time === params.timeHhmm &&
    currentActive.locationId === params.locationId
  ) {
    return {
      ok: false,
      error: "Ya tienes esa misma cita activa. Elige otro horario para reagendar.",
    };
  }
  const cancelled = prev.map((b) =>
    String(b.expedienteId ?? "").trim() === expedienteId &&
    b.status === "booked"
      ? {
          ...b,
          status: "cancelled" as const,
          updatedAt: nowIso,
          cancelledAt: nowIso,
          cancelledBy: { email: actorEmail, role: role ?? "asesor" },
          cancelReason: "Reagendada por asesor",
        }
      : b,
  );
  const availability = getAgendaFirmasDisponibilidad({
    config,
    bookings: cancelled,
    date: params.dateYmd,
    locationId: params.locationId,
  });
  const slot = availability.find((s) => s.time === params.timeHhmm);
  if (!slot || slot.remaining <= 0) {
    return {
      ok: false,
      error: "Ese horario ya no tiene cupo disponible para firma.",
    };
  }
  const [y, mo, d] = params.dateYmd.split("-").map(Number);
  const [hh, mm] = params.timeHhmm.split(":").map(Number);
  const dateIso = new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
  const row: FirmasBookingRow & { id: string; createdAt: string } = {
    id: newBookingId(),
    expedienteId,
    status: "booked",
    date: params.dateYmd,
    time: params.timeHhmm,
    locationId: params.locationId,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: {
      email: actorEmail,
      role: role ?? "asesor",
    },
    note: null,
  };
  const next = [...cancelled, row];
  const payload: AgendaFirmasBookingsDocV1 = {
    version: 1,
    kind: "firmas",
    updatedAt: nowIso,
    bookings: next,
  };
  writeAgendaFirmasBookings(payload);
  return {
    ok: true,
    iso: dateIso,
    rollback: () => {
      writeAgendaFirmasBookings({
        version: 1,
        kind: "firmas",
        updatedAt: nowIso,
        bookings: prev,
      });
    },
  };
}
