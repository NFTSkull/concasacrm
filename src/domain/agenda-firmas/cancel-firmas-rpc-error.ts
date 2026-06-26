import { AgendaFirmasSupabaseError } from "./supabase.error";

/** Mapea errores de RPC `cancel_firmas` a mensajes claros para el asesor. */
export function mapCancelFirmasRpcError(error: {
  code?: string;
  message?: string;
  details?: string;
}): AgendaFirmasSupabaseError {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`.trim();
  const msg = raw.toLowerCase();

  if (
    error.code === "42501" ||
    msg.includes("usuario no autenticado") ||
    msg.includes("perfil no encontrado o inactivo")
  ) {
    return new AgendaFirmasSupabaseError(
      "Tu sesión expiró. Inicia sesión de nuevo.",
    );
  }

  if (msg.includes("rol no autorizado")) {
    return new AgendaFirmasSupabaseError(
      "No tienes permiso para cancelar firmas.",
    );
  }

  if (msg.includes("solo el asesor dueño")) {
    return new AgendaFirmasSupabaseError(
      "Solo el asesor dueño de este expediente puede cancelar la cita.",
    );
  }

  if (msg.includes("solo se puede cancelar en etapa 9")) {
    return new AgendaFirmasSupabaseError(
      "Solo puedes cancelar firma cuando el expediente está en etapa 9 o 10.",
    );
  }

  if (msg.includes("no hay cita de firma activa para cancelar")) {
    return new AgendaFirmasSupabaseError(
      "No hay una cita de firma activa para cancelar.",
    );
  }

  if (msg.includes("expediente no ha sido enviado a mesa")) {
    return new AgendaFirmasSupabaseError(
      "El expediente debe estar enviado a Mesa antes de cancelar firma.",
    );
  }

  if (msg.includes("expediente no encontrado") || msg.includes("expediente no disponible")) {
    return new AgendaFirmasSupabaseError("Expediente no encontrado o no disponible.");
  }

  if (msg.includes("expediente fuera de la organización")) {
    return new AgendaFirmasSupabaseError(
      "No puedes cancelar firma en un expediente de otra organización.",
    );
  }

  if (raw) {
    const cleaned = raw.replace(/^cancel_firmas:\s*/i, "");
    return new AgendaFirmasSupabaseError(cleaned);
  }

  return new AgendaFirmasSupabaseError(
    "No se pudo cancelar la cita de firma. Intenta de nuevo más tarde.",
  );
}
