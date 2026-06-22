/** Error de lectura/escritura `cliente_datos` vía Supabase. */
export class ClienteDatosSupabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClienteDatosSupabaseError";
  }
}
