import { ClienteDatosSupabaseError } from "./supabase.error";

/** Mapea errores de RPC `update_cliente_datos_revision` a mensajes claros en español. */
export function mapUpdateClienteDatosRevisionRpcError(error: {
  code?: string;
  message?: string;
  details?: string;
}): ClienteDatosSupabaseError {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`.trim();
  const msg = raw.toLowerCase();

  if (
    error.code === "42501" ||
    msg.includes("usuario no autenticado") ||
    msg.includes("perfil no encontrado o inactivo")
  ) {
    return new ClienteDatosSupabaseError(
      "No tienes permiso para revisar datos del cliente. Inicia sesión de nuevo.",
    );
  }

  if (msg.includes("rol no autorizado")) {
    return new ClienteDatosSupabaseError(
      "Solo Mesa de control puede validar o rechazar datos generales.",
    );
  }

  if (msg.includes("no autorizado para operar") || msg.includes("fuera de la organización")) {
    return new ClienteDatosSupabaseError(
      "No tienes permiso para revisar datos de este expediente.",
    );
  }

  if (error.code === "P0002" || msg.includes("faltan datos del cliente")) {
    return new ClienteDatosSupabaseError(
      "No hay datos generales del cliente para revisar.",
    );
  }

  if (msg.includes("expediente no encontrado")) {
    return new ClienteDatosSupabaseError("Expediente no encontrado o no disponible.");
  }

  if (msg.includes("aún no fue enviado a mesa")) {
    return new ClienteDatosSupabaseError(
      "Solo puedes revisar datos después de que el expediente fue enviado a Mesa.",
    );
  }

  if (msg.includes("datos del cliente incompletos")) {
    return new ClienteDatosSupabaseError(
      "Los datos del cliente están incompletos; el asesor debe completarlos primero.",
    );
  }

  if (msg.includes("comentario_rechazo es obligatorio")) {
    return new ClienteDatosSupabaseError(
      "Debes indicar un motivo de rechazo antes de guardar.",
    );
  }

  if (msg.includes("estado no permitido")) {
    return new ClienteDatosSupabaseError("Operación de revisión no permitida.");
  }

  if (msg.includes("could not find the function") || msg.includes("schema cache")) {
    return new ClienteDatosSupabaseError(
      "La revisión de datos generales aún no está disponible en el servidor. Contacta soporte.",
    );
  }

  return new ClienteDatosSupabaseError(
    "No se pudo guardar la revisión de datos generales. Intenta de nuevo más tarde.",
  );
}
