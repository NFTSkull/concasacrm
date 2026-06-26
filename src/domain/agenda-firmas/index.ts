"use client";

import { useMemo } from "react";
import { isDataModeSupabase } from "@/lib/dataMode";
import { SupabaseAgendaFirmasConfigRepo } from "./supabase.repo";
import type { AgendaFirmasConfigRepo } from "./repo";

export * from "./repo";
export { AgendaFirmasSupabaseError } from "./supabase.error";
export { mapUpsertAgendaConfigFirmasRpcError } from "./upsert-agenda-config-rpc-error";
export { SupabaseAgendaFirmasConfigRepo } from "./supabase.repo";
export {
  AGENDA_BIOMETRICOS_WEEKDAY_OPTIONS as AGENDA_FIRMAS_WEEKDAY_OPTIONS,
  emptyAgendaBiometricosWeeklyConfig as emptyAgendaFirmasWeeklyConfig,
  slugifyAgendaLocationId,
  type AgendaBiometricosWeeklyLocation as AgendaFirmasWeeklyLocation,
  type AgendaBiometricosWeeklyConfig as AgendaFirmasWeeklyConfig,
} from "@/domain/agenda-biometricos/map-agenda-config";
export type { HhmmTime } from "@/domain/agenda-biometricos/types";
export { canEditAgendaBiometricosWeeklyConfig as canEditAgendaFirmasWeeklyConfig } from "@/domain/agenda-biometricos";

/** Repo Supabase de config firmas; `null` en modo mock. */
export function useAgendaFirmasConfigRepo(): AgendaFirmasConfigRepo | null {
  return useMemo(() => {
    if (isDataModeSupabase()) {
      return new SupabaseAgendaFirmasConfigRepo();
    }
    return null;
  }, []);
}
