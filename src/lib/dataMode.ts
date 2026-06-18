/** Modo de datos: mock por defecto; Supabase solo con flag explícito. */
export function isDataModeSupabase(): boolean {
  return process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
}
