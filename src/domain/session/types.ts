/**
 * Tipos de dominio para la sesión de usuario.
 */

export type Rol = "asesor" | "revisor" | "super_admin";

export interface UserSession {
  email: string;
  role: Rol;
}
