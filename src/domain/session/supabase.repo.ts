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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma SessionRepo; el rol real viene de get_my_role()
  async login(email: string, role: Rol): Promise<UserSession> {
    // El rol real se lee de user_profiles vía get_my_role(), no del argumento.
    const password = (window as Window & { __CONCASA_PASSWORD?: string })
      .__CONCASA_PASSWORD;

    if (!password) {
      throw new Error(
        "Falta password para login de prueba. (En el siguiente paso lo conectamos a un input del login.)"
      );
    }

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
