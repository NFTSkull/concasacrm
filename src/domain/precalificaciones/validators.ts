/**
 * Reglas de negocio centralizadas para precalificaciones.
 * Validaciones que aplican al crear o actualizar.
 */

import type { CreatePrecalificacionInput } from "./types";
import type { Decision } from "./types";

const NSS_REGEX = /^\d{11}$/;
const TELEFONO_REGEX = /^\d{10}$/;
const VALID_DECISIONS: Decision[] = ["pendiente", "aprobado", "no_cumple"];

export function validateCreatePrecalificacion(
  input: CreatePrecalificacionInput
): void {
  const nombre = (input.cliente_nombre ?? "").trim();
  if (nombre.length === 0) {
    throw new Error("El nombre del cliente es requerido.");
  }

  const telefono = (input.telefono_cliente ?? "").trim();
  if (telefono.length === 0) {
    throw new Error("El teléfono del cliente es requerido.");
  }
  if (!TELEFONO_REGEX.test(telefono)) {
    throw new Error(
      "El teléfono del cliente debe tener exactamente 10 dígitos (México)."
    );
  }

  const nss = (input.nss ?? "").trim();
  if (nss.length === 0) {
    throw new Error("El NSS (IMSS) es requerido.");
  }
  if (!NSS_REGEX.test(nss)) {
    throw new Error("El NSS (IMSS) debe tener exactamente 11 dígitos.");
  }
}

export function validateUpdatePrecalificacion(patch: {
  decision?: string;
  monto_aprobado?: number | null;
  notas_revision?: string;
  notas?: string;
}): void {
  if (patch.decision !== undefined) {
    if (!VALID_DECISIONS.includes(patch.decision as Decision)) {
      throw new Error(
        `Decisión inválida. Debe ser: ${VALID_DECISIONS.join(", ")}.`
      );
    }
  }
}
