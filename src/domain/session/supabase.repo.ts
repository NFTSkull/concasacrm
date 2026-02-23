import { supabase } from "@/lib/supabaseClient";
import type { Rol, UserSession } from "./types";
import type { SessionRepo } from "./repo";

type SupabaseRole = "asesor" | "revisor" | "super_admin";

function isSupabaseRole(v: unknown): v is SupabaseRole {
  return v === "asesor" || v === "revisor" || v === "super_admin";
}

function mapRole(r: SupabaseRole): Rol {
  return r as Rol;
}

export class SupabaseSessionRepo implements SessionRepo {
  async getCurrentUser(): Promise<UserSession | null> {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.email) return null;

    const { data: roleData, error: roleErr } =
      await supabase.rpc("get_my_role");
    if (roleErr) {
      throw new Error(
        `No pude obtener el rol (get_my_role): ${roleErr.message}`
      );
    }

    if (!isSupabaseRole(roleData)) {
      throw new Error(
        "Rol inválido en la base de datos. Esperado: asesor | revisor | super_admin"
      );
    }

    return { email: user.email, role: mapRole(roleData) };
  }

  async login(email: string, password: string): Promise<UserSession> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);

    const session = await this.getCurrentUser();
    if (!session) throw new Error("Login exitoso pero no hay sesión.");
    return session;
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }
}
