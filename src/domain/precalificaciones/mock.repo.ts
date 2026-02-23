"use client";

import type { MockStoreContextValue } from "@/context/MockStoreContext";
import type { Precalificacion, CreatePrecalificacionInput } from "./types";
import type { PrecalificacionesRepo } from "./repo";
import {
  validateCreatePrecalificacion,
  validateUpdatePrecalificacion,
} from "./validators";

/**
 * Implementación del repositorio de precalificaciones que usa MockStoreContext por debajo.
 * Se instancia con el valor del contexto (p. ej. desde useMockStore()).
 */
export class MockPrecalificacionesRepo implements PrecalificacionesRepo {
  constructor(private store: MockStoreContextValue) {}

  async listForUser(user: {
    email: string;
    role: string;
  }): Promise<Precalificacion[]> {
    if (user.role === "asesor") {
      return Promise.resolve(
        this.store.getPrecalificacionesByAsesor(user.email)
      );
    }
    return Promise.resolve(this.store.getAllPrecalificaciones());
  }

  async listPageForUser(
    user: { email: string; role: string },
    options: { page: number; pageSize: number }
  ): Promise<{ data: Precalificacion[]; count: number }> {
    const all = await this.listForUser(user);
    const sorted = [...all].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const { page, pageSize } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return {
      data: sorted.slice(from, to),
      count: sorted.length,
    };
  }

  async getById(id: string): Promise<Precalificacion | null> {
    const p = this.store.getPrecalificacionById(id);
    return Promise.resolve(p ?? null);
  }

  async create(input: CreatePrecalificacionInput): Promise<Precalificacion> {
    validateCreatePrecalificacion(input);
    const created = this.store.addPrecalificacion(input);
    if (!created) {
      throw new Error("No se pudo crear la precalificación (rol no asesor o no autenticado)");
    }
    return Promise.resolve(created);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        Precalificacion,
        "decision" | "monto_aprobado" | "notas_revision" | "notas"
      >
    >
  ): Promise<Precalificacion> {
    validateUpdatePrecalificacion(patch);
    const updated = this.store.updatePrecalificacion(id, {
      monto_aprobado: patch.monto_aprobado,
      notas: patch.notas,
      notas_revision: patch.notas_revision,
      decision: patch.decision,
    });
    if (!updated) {
      throw new Error("Precalificación no encontrada");
    }
    return Promise.resolve(updated);
  }
}
