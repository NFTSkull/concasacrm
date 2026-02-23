/**
 * Contrato del repositorio de sesión.
 * La UI depende de esta interfaz; las implementaciones (mock, Supabase Auth) la cumplen.
 */

import type { UserSession, Rol } from "./types";

export interface SessionRepo {
  getCurrentUser(): Promise<UserSession | null>;
  login(email: string, role: Rol): Promise<UserSession>;
  logout(): Promise<void>;
}
