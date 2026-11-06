"use client";

import { createClient } from "@supabase/supabase-js";

// Separate Supabase Auth solely for the TEST WhatsApp pilot.
// The operational ConCasa CRM's NEXT_PUBLIC_SUPABASE_URL and keys are not changed.
const PILOT_URL = "https://fvtqbxukqlajezyyvwzy.supabase.co";
const url = process.env.NEXT_PUBLIC_WHATSAPP_PILOT_URL;
const key = process.env.NEXT_PUBLIC_WHATSAPP_PILOT_PUBLISHABLE_KEY;

export function isWhatsAppPilotConfigured(): boolean {
  return Boolean(url === PILOT_URL && key?.startsWith("sb_publishable_"));
}

// Dedicated storage key and client ensure sessions never overwrite the current
// CRM auth session, which may refer to an older Supabase project.
export const whatsappPilotSupabase = isWhatsAppPilotConfigured()
  ? createClient(url!, key!, {
      auth: {
        storageKey: "concasa-wa-pilot-fvtqbxukqlajezyyvwzy",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const PILOT_ADVISOR_ID = "7f5c513e-ca81-4811-a349-531b02a345d3";
export const PILOT_EMAIL = "prueba@concasa.mx";
