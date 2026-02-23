/**
 * Variables de entorno validadas para ConCasa CRM.
 * Si faltan, se lanza Error con mensaje claro (configurar .env.local).
 * NO hardcodear credenciales en el código.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || typeof url !== "string" || url.trim() === "") {
  throw new Error(
    "Falta NEXT_PUBLIC_SUPABASE_URL. Configura .env.local con NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase"
  );
}

if (!anonKey || typeof anonKey !== "string" || anonKey.trim() === "") {
  throw new Error(
    "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Configura .env.local con NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key"
  );
}

export const SUPABASE_URL = url.trim();
export const SUPABASE_ANON_KEY = anonKey.trim();
