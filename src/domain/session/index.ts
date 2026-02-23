"use client";

import { useEffect, useMemo, useState } from "react";
import { SupabaseSessionRepo } from "./supabase.repo";
import type { UserSession } from "./types";
import type { SessionRepo } from "./repo";

export type { UserSession, Rol } from "./types";
export type { SessionRepo } from "./repo";
export { SupabaseSessionRepo } from "./supabase.repo";

/**
 * Hook que devuelve el repositorio de sesión y el usuario actual (sincronizado).
 * currentUser es undefined mientras no se ha resuelto la sesión; null si no hay usuario; UserSession si hay sesión.
 * Usa SupabaseSessionRepo como única fuente de verdad del login.
 */
export function useSessionRepo(): {
  sessionRepo: SessionRepo;
  /** undefined = aún cargando, null = no hay sesión, UserSession = sesión activa */
  currentUser: UserSession | null | undefined;
} {
  const sessionRepo = useMemo(() => new SupabaseSessionRepo(), []);
  const [currentUser, setCurrentUser] = useState<
    UserSession | null | undefined
  >(undefined);

  useEffect(() => {
    sessionRepo
      .getCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, [sessionRepo]);

  return { sessionRepo, currentUser };
}
