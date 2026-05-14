/**
 * Tipos de dominio para la sesión de usuario.
 * 
 * Nota: en este proyecto copiado se usan roles adicionales de "visión" mock
 * (admin, editor, mesa_control) únicamente en cliente. Los roles reales de Supabase
 * siguen siendo asesor | revisor | super_admin.
 */

export type Rol =
  | "asesor"
  | "revisor"
  | "super_admin"
  | "admin"
  | "editor"
  | "mesa_control";

export interface UserSession {
  email: string;
  role: Rol;
}
