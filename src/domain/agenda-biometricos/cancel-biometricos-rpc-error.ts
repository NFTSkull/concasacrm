import { AgendaBiometricosSupabaseError } from "./supabase.error";

/** Mapea errores de RPC `cancel_biometricos` a mensajes claros para el asesor. */
export function mapCancelBiometricosRpcError(error: {
  code?: string;
  message?: string;
  details?: string;
}): AgendaBiometricosSupabaseError {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`.trim();
  const msg = raw.toLowerCase();

  if (
    error.code === "42501" ||
    msg.includes("usuario no autenticado") ||
    msg.includes("perfil no encontrado o inactivo")
  ) {
    return new AgendaBiometricosSupabaseError(
      "Tu sesión expiró. Inicia sesión de nuevo.",
    );
  }

  if (msg.includes("rol no autorizado")) {
    return new AgendaBiometricosSupabaseError(
      "No tienes permiso para cancelar biométricos.",
    );
  }

  if (msg.includes("solo el asesor dueño")) {
    return new AgendaBiometricosSupabaseError(
      "Solo el asesor dueño de este expediente puede cancelar la cita.",
    );
  }

  if (msg.includes("solo se puede cancelar en etapa 4")) {
    return new AgendaBiometricosSupabaseError(
      "Solo puedes cancelar biométricos cuando el expediente está en etapa 4.",
    );
  }

  if (msg.includes("no hay cita biométrica activa para cancelar")) {
    return new AgendaBiometricosSupabaseError(
      "No hay una cita biométrica activa para cancelar.",
    );
  }

  if (msg.includes("expediente no ha sido enviado a mesa")) {
    return new AgendaBiometricosSupabaseError(
      "El expediente debe estar enviado a Mesa antes de cancelar biométricos.",
    );
  }

  if (msg.includes("expediente no encontrado") || msg.includes("expediente no disponible")) {
    return new AgendaBiometricosSupabaseError("Expediente no encontrado o no disponible.");
  }

  if (msg.includes("expediente fuera de la organización")) {
    return new AgendaBiometricosSupabaseError(
      "No puedes cancelar biométricos en un expediente de otra organización.",
    );
  }

  if (raw) {
    const cleaned = raw.replace(/^cancel_biometricos:\s*/i, "");
    return new AgendaBiometricosSupabaseError(cleaned);
  }

  return new AgendaBiometricosSupabaseError(
    "No se pudo cancelar la cita biométrica. Intenta de nuevo más tarde.",
  );
}
