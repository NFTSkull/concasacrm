/**
 * Tipos de dominio del módulo Precalificaciones.
 * Fuente única de verdad para el modelo.
 */

export type Programa = "Mejoravit" | "Subcuenta" | "Compro tu casa";

/** Decisión del revisor sobre la precalificación */
export type Decision = "pendiente" | "aprobado" | "no_cumple";

export interface Precalificacion {
  id: string;
  asesorId: string;
  programa: Programa;
  nss: string;
  cliente_nombre: string;
  telefono_cliente: string;
  /** @deprecated Compatibilidad con datos existentes */
  fecha_nacimiento?: string;
  direccion_opcional: string;
  monto_aprobado: number | null;
  notas: string;
  createdAt: string;
  decision?: Decision;
  notas_revision?: string;
}

/** Payload para crear una precalificación (el asesorId lo aporta el contexto/sesión) */
export interface CreatePrecalificacionInput {
  programa: Programa;
  nss: string;
  cliente_nombre: string;
  telefono_cliente: string;
  direccion_opcional: string;
}
