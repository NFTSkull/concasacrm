export class AgendaFirmasSupabaseError extends Error {
  readonly name = "AgendaFirmasSupabaseError";

  constructor(message: string) {
    super(message);
  }
}
