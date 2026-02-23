"use client";

import { useMemo } from "react";
import { SupabasePrecalificacionesRepo } from "./supabase.repo";
import type { PrecalificacionesRepo } from "./repo";

export type { Precalificacion, Programa, Decision, CreatePrecalificacionInput } from "./types";
export type { PrecalificacionesRepo } from "./repo";
export { MockPrecalificacionesRepo } from "./mock.repo";
export { SupabasePrecalificacionesRepo } from "./supabase.repo";

/**
 * Hook que devuelve el repositorio de precalificaciones.
 * Usa Supabase (public.precalificaciones) como fuente de verdad.
 */
export function usePrecalificacionesRepo(): PrecalificacionesRepo {
  return useMemo(() => new SupabasePrecalificacionesRepo(), []);
}
