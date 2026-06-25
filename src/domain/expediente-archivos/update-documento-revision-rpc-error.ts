import { ExpedienteArchivosSupabaseError } from "./supabase.error";

/** Mapea errores de RPC `update_documento_revision` a mensajes claros en español. */
export function mapUpdateDocumentoRevisionRpcError(error: {
  code?: string;
  message?: string;
  details?: string;
}): ExpedienteArchivosSupabaseError {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`.trim();
  const msg = raw.toLowerCase();

  if (msg.includes("rol no autorizado")) {
    return new ExpedienteArchivosSupabaseError(
      "Solo Mesa de control puede validar o rechazar documentos.",
    );
  }

  if (
    error.code === "42501" ||
    msg.includes("usuario no autenticado") ||
    msg.includes("perfil no encontrado o inactivo")
  ) {
    return new ExpedienteArchivosSupabaseError(
      "No tienes permiso para revisar documentos. Inicia sesión de nuevo.",
    );
  }

  if (msg.includes("no autorizado para operar") || msg.includes("fuera de la organización")) {
    return new ExpedienteArchivosSupabaseError(
      "No tienes permiso para revisar documentos de este expediente.",
    );
  }

  if (error.code === "P0002" || msg.includes("documento no encontrado")) {
    return new ExpedienteArchivosSupabaseError("Documento no encontrado o no disponible.");
  }

  if (msg.includes("documento o expediente no disponible")) {
    return new ExpedienteArchivosSupabaseError("El documento o expediente ya no está disponible.");
  }

  if (msg.includes("comentario_mesa es obligatorio al rechazar")) {
    return new ExpedienteArchivosSupabaseError(
      "Debes indicar un motivo de rechazo antes de guardar.",
    );
  }

  if (msg.includes("documento_id es obligatorio") || msg.includes("estatus_revision es obligatorio")) {
    return new ExpedienteArchivosSupabaseError(
      "No se pudo guardar la revisión. Intenta de nuevo.",
    );
  }

  return new ExpedienteArchivosSupabaseError(
    "No se pudo guardar la revisión del documento. Intenta de nuevo más tarde.",
  );
}
