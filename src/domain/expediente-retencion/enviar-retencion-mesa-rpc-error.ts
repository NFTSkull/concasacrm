import { ExpedienteRetencionSupabaseError } from "./supabase.error";

/** Mapea errores de RPC `enviar_retencion_mesa` a mensajes claros para el asesor. */
export function mapEnviarRetencionMesaRpcError(error: {
  code?: string;
  message?: string;
  details?: string;
}): ExpedienteRetencionSupabaseError {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`.trim();
  const msg = raw.toLowerCase();

  if (
    error.code === "42501" ||
    msg.includes("usuario no autenticado") ||
    msg.includes("perfil no encontrado o inactivo")
  ) {
    return new ExpedienteRetencionSupabaseError(
      "Tu sesión expiró. Inicia sesión de nuevo.",
    );
  }

  if (msg.includes("rol no autorizado")) {
    return new ExpedienteRetencionSupabaseError(
      "No tienes permiso para enviar retención a Mesa.",
    );
  }

  if (msg.includes("solo el asesor dueño")) {
    return new ExpedienteRetencionSupabaseError(
      "Solo el asesor dueño de este expediente puede enviar retención a Mesa.",
    );
  }

  if (msg.includes("expediente no enviado a mesa")) {
    return new ExpedienteRetencionSupabaseError(
      "El expediente debe estar enviado a Mesa antes de enviar retención.",
    );
  }

  if (msg.includes("debe estar en etapa 8")) {
    return new ExpedienteRetencionSupabaseError(
      "Solo puedes enviar retención cuando el expediente está en etapa 8.",
    );
  }

  if (msg.includes("subestado debe ser en_proceso")) {
    return new ExpedienteRetencionSupabaseError(
      "No puedes enviar retención en el subestado actual del expediente.",
    );
  }

  if (msg.includes("retencion_opcion es obligatoria")) {
    return new ExpedienteRetencionSupabaseError(
      "Selecciona la opción A (con sello) o B (sin sello) antes de enviar.",
    );
  }

  if (msg.includes("falta documento")) {
    return new ExpedienteRetencionSupabaseError(
      "Faltan documentos requeridos para la opción elegida. Sube todos antes de enviar.",
    );
  }

  if (msg.includes("rechazado; reemplazar antes de enviar")) {
    return new ExpedienteRetencionSupabaseError(
      "Hay documentos rechazados por Mesa. Reemplázalos antes de reenviar.",
    );
  }

  if (msg.includes("no listo para envío")) {
    return new ExpedienteRetencionSupabaseError(
      "Algunos documentos aún no están listos para envío. Revisa el checklist.",
    );
  }

  if (msg.includes("bloque ya enviado a mesa")) {
    return new ExpedienteRetencionSupabaseError(
      "El bloque de retención ya fue enviado a Mesa y está en revisión.",
    );
  }

  if (msg.includes("ciclo activo")) {
    return new ExpedienteRetencionSupabaseError(
      "No puedes enviar retención en el estado actual del expediente.",
    );
  }

  return new ExpedienteRetencionSupabaseError(
    "No se pudo enviar retención a Mesa. Intenta de nuevo más tarde.",
  );
}
