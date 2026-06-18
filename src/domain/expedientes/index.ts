"use client";

import { useMemo } from "react";
import { isDataModeSupabase } from "@/lib/dataMode";
import { MockExpedientesRepo } from "./mock.repo";
import { SupabaseExpedientesRepo } from "./supabase.repo";
import type { ExpedientesRepo } from "./repo";

export type { ExpedientesRepo } from "./repo";
export type { ExpedienteMock } from "./mock.repo";
export { MockExpedientesRepo } from "./mock.repo";
export { SupabaseExpedientesRepo, ExpedientesSupabaseError } from "./supabase.repo";
export {
  mapProgramaDbToUi,
  mapSupabaseRowToExpedienteMock,
} from "./map-supabase-row";

/** Factory: mock por defecto; Supabase read-only admin con `NEXT_PUBLIC_DATA_MODE=supabase`. */
export function useExpedientesRepo(): ExpedientesRepo {
  return useMemo(() => {
    if (isDataModeSupabase()) {
      return new SupabaseExpedientesRepo();
    }
    return new MockExpedientesRepo();
  }, []);
}
