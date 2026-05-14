"use client";

import { useMemo } from "react";
import type { PrecalificacionesRepo } from "./repo";
import { MockPrecalificacionesRepo } from "./mock.repo";
import { useMockStore } from "@/context/MockStoreContext";

export type {
  Precalificacion,
  Programa,
  Decision,
  CreatePrecalificacionInput,
} from "./types";
export type { PrecalificacionesRepo } from "./repo";
export { MockPrecalificacionesRepo } from "./mock.repo";

/**
 * Hook que devuelve el repositorio de precalificaciones.
 * En este proyecto copiado, usamos el mock store en memoria.
 */
export function usePrecalificacionesRepo(): PrecalificacionesRepo {
  const store = useMockStore();
  return useMemo(() => new MockPrecalificacionesRepo(store), [store]);
}
