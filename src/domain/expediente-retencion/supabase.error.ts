/** Error de dominio para operaciones Supabase de retención etapa 8 (asesor). */
export class ExpedienteRetencionSupabaseError extends Error {
  readonly name = "ExpedienteRetencionSupabaseError";

  constructor(message: string) {
    super(message);
  }
}
