"use client";

import { useEffect, useMemo, useState } from "react";
import { MockSessionRepo } from "./mock.repo";
import { getEffectiveMockEmail, getEffectiveMockRole } from "@/lib/mockUser";
import { useMockStore } from "@/context/MockStoreContext";
import type { UserSession, Rol } from "./types";
import type { SessionRepo } from "./repo";

export type { UserSession, Rol } from "./types";
export type { SessionRepo } from "./repo";
export { MockSessionRepo } from "./mock.repo";

/**
 * Hook que devuelve el repositorio de sesión y el usuario actual (sincronizado).
 * currentUser es undefined mientras no se ha resuelto la sesión; null si no hay usuario; UserSession si hay sesión.
 * Usa MockSessionRepo como fuente de verdad del login en modo demo.
 */
export function useSessionRepo(): {
  sessionRepo: SessionRepo;
  /** undefined = aún cargando, null = no hay sesión, UserSession = sesión activa */
  currentUser: UserSession | null | undefined;
} {
  const store = useMockStore();
  const sessionRepo = useMemo(() => new MockSessionRepo(store), [store]);
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
        const normalizedRole =
          mockRole === "revisor" ? "editor" : mockRole;
        if (mesaMockRoles.includes(mockRole as (typeof mesaMockRoles)[number])) {
          mockSession = { email: mockEmail, role: "mesa_control" };
        } else {
          switch (normalizedRole) {
            case "asesor":
            case "super_admin":
            case "admin":
            case "editor":
              mockSession = { email: mockEmail, role: normalizedRole as Rol };
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
          roleOverride === "super_admin" ||
          roleOverride === "admin" ||
          roleOverride === "editor"
        ) {
          setCurrentUser({ ...user, role: roleOverride });
        } else if (roleOverride && mesaOverride.includes(roleOverride)) {
          setCurrentUser({ ...user, role: "mesa_control" });
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
