/**
 * Contrato del repositorio de precalificaciones.
 * La UI depende de esta interfaz; las implementaciones (mock, Supabase) la cumplen.
 */

import type { Precalificacion, CreatePrecalificacionInput } from "./types";

export interface PrecalificacionesRepo {
  /** Lista precalificaciones según el rol: asesor → solo las suyas; revisor/admin → todas */
  listForUser(user: {
    email: string;
    role: string;
  }): Promise<Precalificacion[]>;

  /**
   * Lista una página de precalificaciones con orden createdAt DESC y total para paginación.
   * revisor/super_admin: todas; asesor: solo las suyas.
   */
  listPageForUser(
    user: { email: string; role: string },
    options: { page: number; pageSize: number }
  ): Promise<{ data: Precalificacion[]; count: number }>;

  /** Obtiene una precalificación por id (para edición en revisor/admin) */
  getById(id: string): Promise<Precalificacion | null>;

  create(input: CreatePrecalificacionInput): Promise<Precalificacion>;

  update(
    id: string,
    patch: Partial<
      Pick<
        Precalificacion,
        "decision" | "monto_aprobado" | "notas_revision" | "notas"
      >
    >
  ): Promise<Precalificacion>;
}
