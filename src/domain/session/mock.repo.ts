"use client";

import type { MockStoreContextValue } from "@/context/MockStoreContext";
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
      typeof parsed?.role === "string" &&
      ["asesor", "revisor", "super_admin"].includes(parsed.role)
    ) {
      return { email: parsed.email, role: parsed.role as Rol };
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
      this.store.login(fromStorage.email, "", fromStorage.role as Rol);
      return Promise.resolve(fromStorage);
    }
    return Promise.resolve(null);
  }

  async login(email: string, role: Rol): Promise<UserSession> {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email, role })
    );
    this.store.login(email, "", role);
    return Promise.resolve({ email, role });
  }

  async logout(): Promise<void> {
    this.store.logout();
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
    return Promise.resolve();
  }
}
