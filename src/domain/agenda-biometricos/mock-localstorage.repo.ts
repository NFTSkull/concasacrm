"use client";

import type {
  AgendaBiometricosBookingsV1,
  AgendaBiometricosConfigV1,
} from "./types";

export const AGENDA_CONFIG_KEY_V1 = "agenda_config_v1";
export const AGENDA_BOOKINGS_KEY_V1 = "agenda_bookings_v1";

function safeJsonParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isConfigV1(v: unknown): v is AgendaBiometricosConfigV1 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && o.kind === "biometricos";
}

function isBookingsV1(v: unknown): v is AgendaBiometricosBookingsV1 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && o.kind === "biometricos" && Array.isArray(o.bookings);
}

export class MockAgendaBiometricosLocalStorageRepo {
  readConfig(): AgendaBiometricosConfigV1 | null {
    if (typeof window === "undefined") return null;
    const parsed = safeJsonParse(window.localStorage.getItem(AGENDA_CONFIG_KEY_V1));
    return isConfigV1(parsed) ? parsed : null;
  }

  readBookings(): AgendaBiometricosBookingsV1 {
    if (typeof window === "undefined") {
      return { version: 1, kind: "biometricos", updatedAt: new Date().toISOString(), bookings: [] };
    }
    const parsed = safeJsonParse(window.localStorage.getItem(AGENDA_BOOKINGS_KEY_V1));
    if (isBookingsV1(parsed)) return parsed;
    return { version: 1, kind: "biometricos", updatedAt: new Date().toISOString(), bookings: [] };
  }

  writeConfig(next: AgendaBiometricosConfigV1): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AGENDA_CONFIG_KEY_V1, JSON.stringify(next));
    window.dispatchEvent(new Event("agenda_config_updated"));
  }

  writeBookings(next: AgendaBiometricosBookingsV1): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AGENDA_BOOKINGS_KEY_V1, JSON.stringify(next));
    window.dispatchEvent(new Event("agenda_bookings_updated"));
  }
}

