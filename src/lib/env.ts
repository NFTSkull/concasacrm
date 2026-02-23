/**
 * Variables de entorno para ConCasa CRM.
 * En local: configurar .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * En Vercel: añadir las mismas variables en Project → Settings → Environment Variables
 * para que Auth y precalificaciones funcionen. Si faltan en build, el deploy no falla (evita 404).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_URL = typeof url === "string" ? url.trim() : "";
export const SUPABASE_ANON_KEY = typeof anonKey === "string" ? anonKey.trim() : "";
