"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes("dummy.supabase.local"),
  );
}

export const supabaseBrowser = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Auth Supabase real solo si el flag está activo y hay URL/key válidos. */
export function isSupabaseAuthEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === "true" &&
    isSupabaseConfigured()
  );
}
