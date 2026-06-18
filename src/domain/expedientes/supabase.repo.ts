"use client";

import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";
import type { ExpedientesRepo } from "./repo";
import type { ExpedienteMock } from "./mock.repo";
import {
  mapSupabaseRowToExpedienteMock,
  type SupabaseExpedienteListRow,
} from "./map-supabase-row";

const ADMIN_LIST_SELECT = `
  id,
  programa,
  nss,
  cliente_nombre,
  telefono_cliente,
  direccion_opcional,
  asesor_id,
  origen_mesa,
  submitted_to_mesa,
  fecha_envio_mesa,
  etapa_actual,
  subestado,
  motivo_rechazo,
  comentario_rechazo,
  fecha_cita,
  created_at,
  updated_at,
  editor_decisions ( decision, monto_aprobado, notas_revision ),
  asesor:profiles!expedientes_asesor_id_fkey ( email, full_name )
`;

export class ExpedientesSupabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpedientesSupabaseError";
  }
}

/**
 * Lectura admin vía RLS (JWT del usuario autenticado).
 * P3B.1: solo `listForAdmin()`.
 */
export class SupabaseExpedientesRepo implements ExpedientesRepo {
  async listForAdmin(): Promise<ExpedienteMock[]> {
    if (!isSupabaseConfigured() || !supabaseBrowser) {
      throw new ExpedientesSupabaseError(
        "Supabase no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }

    const client = supabaseBrowser;
    const {
      data: { session },
      error: sessionError,
    } = await client.auth.getSession();

    if (sessionError || !session?.user) {
      throw new ExpedientesSupabaseError(
        "No hay sesión de Supabase activa. Inicia sesión de nuevo.",
      );
    }

    const { data, error } = await client
      .from("expedientes")
      .select(ADMIN_LIST_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ExpedientesSupabaseError(
        "No se pudo cargar el listado de expedientes. Intenta de nuevo más tarde.",
      );
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row) =>
      mapSupabaseRowToExpedienteMock(row as SupabaseExpedienteListRow),
    );
  }
}
