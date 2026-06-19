export class ExpedientesSupabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpedientesSupabaseError";
  }
}
