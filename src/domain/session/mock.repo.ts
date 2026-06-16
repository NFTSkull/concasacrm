"use client";

import type { MockStoreContextValue } from "@/context/MockStoreContext";
import { clearMockUser, normalizeLegacyMockRole } from "@/lib/mockUser";
import type { UserSession, Rol } from "./types";
import type { SessionRepo } from "./repo";

const SESSION_KEY = "concasa_session";

function toUserSession(
  user: { email: string; rol: string } | null
): UserSession | null {
  if (!user) return null;
  return {
    email: user.email,
    role: user.rol as Rol,
  };
}

function readSessionFromStorage(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; role?: string };
    if (
      typeof parsed?.email === "string" &&
      typeof parsed?.role === "string"
    ) {
      const role = normalizeLegacyMockRole(parsed.role);
      if (["asesor", "editor", "super_admin", "revisor"].includes(role)) {
        return {
          email: parsed.email,
          role: (role === "revisor" ? "editor" : role) as Rol,
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Implementación del repositorio de sesión que usa MockStoreContext por debajo.
 * Persiste la sesión en localStorage (key: concasa_session) para que sobreviva a recargas.
 */
export class MockSessionRepo implements SessionRepo {
  constructor(private store: MockStoreContextValue) {}

  async getCurrentUser(): Promise<UserSession | null> {
    const fromStore = toUserSession(this.store.currentUser);
    if (fromStore) return Promise.resolve(fromStore);
    const fromStorage = readSessionFromStorage();
    if (fromStorage) {
      const role =
        fromStorage.role === "revisor" ? "editor" : fromStorage.role;
      if (
        role === "asesor" ||
        role === "editor" ||
        role === "super_admin" ||
        role === "mesa_control"
      ) {
        this.store.login(fromStorage.email, "", role);
      }
      return Promise.resolve({
        email: fromStorage.email,
        role: role as Rol,
      });
    }
    return Promise.resolve(null);
  }

  async login(email: string, password: string): Promise<UserSession> {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email, role: "asesor" })
    );
    this.store.login(email, password, "asesor");
    return Promise.resolve({ email, role: "asesor" });
  }

  async logout(): Promise<void> {
    this.store.logout();
    clearMockUser();
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
    return Promise.resolve();
  }
}
