/**
 * Cliente de Supabase para ConCasa CRM.
 * Lee credenciales desde src/lib/env.ts (validadas; no hardcodeadas).
 */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
