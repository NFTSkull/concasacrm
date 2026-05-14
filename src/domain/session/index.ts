"use client";

import { useEffect, useMemo, useState } from "react";
import { SupabaseSessionRepo } from "./supabase.repo";
import { getEffectiveMockEmail, getEffectiveMockRole } from "@/lib/mockUser";
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
  /**
   * Siempre `undefined` en el primer render (SSR + hidratación) para evitar mismatch:
   * no leer localStorage en el inicializador de useState (solo existe en cliente).
   * La sesión mock o Supabase se resuelve en useEffect tras montar.
   */
  const [currentUser, setCurrentUser] = useState<UserSession | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      const mockEmail = getEffectiveMockEmail();
      const mockRole = getEffectiveMockRole();

      const mesaMockRoles = [
        "mesa_control",
        "mesa_control_admin",
        "mesa_control_interno",
        "mesa_control_externo",
      ] as const;

      if (mockEmail && mockRole) {
        let mockSession: UserSession | null = null;
        if (mesaMockRoles.includes(mockRole as (typeof mesaMockRoles)[number])) {
          mockSession = { email: mockEmail, role: "revisor" };
        } else {
          switch (mockRole) {
            case "asesor":
            case "revisor":
            case "super_admin":
            case "admin":
            case "editor":
              mockSession = { email: mockEmail, role: mockRole };
              break;
            default:
              mockSession = null;
          }
        }
        if (mockSession && !cancelled) {
          setCurrentUser(mockSession);
          return;
        }
      }

      try {
        const user = await sessionRepo.getCurrentUser();
        if (cancelled) return;
        if (!user) {
          setCurrentUser(null);
          return;
        }
        const roleOverride = getEffectiveMockRole();
        const mesaOverride = [
          "mesa_control",
          "mesa_control_admin",
          "mesa_control_interno",
          "mesa_control_externo",
        ];
        if (
          roleOverride === "asesor" ||
          roleOverride === "revisor" ||
          roleOverride === "super_admin" ||
          roleOverride === "admin" ||
          roleOverride === "editor"
        ) {
          setCurrentUser({ ...user, role: roleOverride });
        } else if (roleOverride && mesaOverride.includes(roleOverride)) {
          setCurrentUser({ ...user, role: "revisor" });
        } else {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) setCurrentUser(null);
      }
    };

    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, [sessionRepo]);

  return { sessionRepo, currentUser };
}
