/**
 * Tipos y datos mock en memoria para ConCasa CRM (solo UI).
 * Los tipos de dominio viven en @/domain/precalificaciones/types; se re-exportan aquí por compatibilidad.
 */

import type { Precalificacion as PrecalificacionDomain, Programa as ProgramaDomain, Decision } from "@/domain/precalificaciones/types";

export type Programa = ProgramaDomain;
export type Precalificacion = PrecalificacionDomain;
/** @deprecated Usar Decision de domain/precalificaciones/types */
export type DecisionPrecalificacion = Decision;

export type Rol = "asesor" | "revisor" | "super_admin";

export interface UsuarioMock {
  email: string;
  rol: Rol;
}

export const PROGRAMAS: Programa[] = [
  "Mejoravit",
  "Subcuenta",
  "Compro tu casa",
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPrecalificacion(
  input: Omit<
    Precalificacion,
    | "id"
    | "monto_aprobado"
    | "notas"
    | "createdAt"
    | "decision"
    | "notas_revision"
    | "fecha_nacimiento"
  > & { fecha_nacimiento?: string }
): Precalificacion {
  return {
    ...input,
    id: createId(),
    monto_aprobado: null,
    notas: "",
    createdAt: new Date().toISOString(),
    decision: "pendiente",
    notas_revision: "",
  };
}

/** Formatea createdAt (ISO) a dd/mm/yyyy hh:mm */
export function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${min}`;
}
