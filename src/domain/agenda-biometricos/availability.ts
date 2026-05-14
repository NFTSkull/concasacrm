import type {
  AgendaBiometricosBookingsV1,
  AgendaBiometricosConfigV1,
  AgendaBiometricosLocationId,
  AgendaBiometricosSlotAvailability,
  HhmmTime,
  YmdDate,
} from "./types";

function toInt(n: number): number {
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseHhmmToMinutes(hhmm: HhmmTime): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatYmd(d: Date): YmdDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` as YmdDate;
}

function addDaysYmd(dateYmd: YmdDate, days: number): YmdDate {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const base = new Date(y, mo - 1, d, 12, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return formatYmd(base);
}

export function computeMinBookableDateYmd(
  now: Date,
  rules: AgendaBiometricosConfigV1["rules"],
): YmdDate {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayYmd = formatYmd(today);

  const cutoffMins = parseHhmmToMinutes(rules.afterTimeLocal);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const useLead =
    cutoffMins != null && nowMins >= cutoffMins
      ? rules.minLeadDaysAfterCutoff
      : rules.minLeadDays;

  return addDaysYmd(todayYmd, Math.max(0, toInt(useLead)));
}

function countBookedForSlot(params: {
  bookings: AgendaBiometricosBookingsV1;
  date: YmdDate;
  locationId: AgendaBiometricosLocationId;
  time: HhmmTime;
  excludeExpedienteId?: string;
}): number {
  const { bookings, date, locationId, time, excludeExpedienteId } = params;
  let n = 0;
  for (const b of bookings.bookings) {
    if (b.status !== "booked") continue;
    if (b.date !== date) continue;
    if (b.locationId !== locationId) continue;
    if (b.time !== time) continue;
    if (excludeExpedienteId && b.expedienteId === excludeExpedienteId) continue;
    n += 1;
  }
  return n;
}

/**
 * ÚNICA fuente de verdad de disponibilidad.
 * - Sin config del día => 0 slots.
 * - La capacidad se calcula por slot (capacity - bookings.booked).
 * - No usa `mesa_control_inbox`.
 */
export function getAgendaBiometricosDisponibilidad(params: {
  config: AgendaBiometricosConfigV1;
  bookings: AgendaBiometricosBookingsV1;
  date: YmdDate;
  locationId: AgendaBiometricosLocationId;
  excludeExpedienteId?: string;
}): AgendaBiometricosSlotAvailability[] {
  const { config, bookings, date, locationId, excludeExpedienteId } = params;
  const day = config.days[date];
  const loc = day?.[locationId];
  const locationMeta = config.locations.find((l) => l.id === locationId);
  if (locationMeta?.active === false) return [];
  const slots = (loc?.slots ?? []).filter((s) => s.active !== false);
  const out: AgendaBiometricosSlotAvailability[] = [];
  for (const s of slots) {
    const cap = Math.max(0, toInt(s.capacity));
    const bookedCount = countBookedForSlot({
      bookings,
      date,
      locationId,
      time: s.time,
      excludeExpedienteId,
    });
    const remaining = Math.max(0, cap - bookedCount);
    out.push({
      date,
      locationId,
      time: s.time,
      capacity: cap,
      bookedCount,
      remaining,
    });
  }
  return out;
}

export function isSlotBookable(params: {
  availability: AgendaBiometricosSlotAvailability[];
  time: HhmmTime;
}): boolean {
  const { availability, time } = params;
  const slot = availability.find((a) => a.time === time);
  return Boolean(slot && slot.remaining > 0);
}

