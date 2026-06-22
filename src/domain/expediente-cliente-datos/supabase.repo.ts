"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";
import type { ExpedienteClienteDatosRepo } from "./repo";
import type {
  ExpedienteClienteDatos,
  SaveExpedienteClienteDatosInput,
  UpdateEstadoExpedienteClienteDatosInput,
} from "./types";
import {
  buildSaveClienteDatosRpcPayload,
  mapSupabaseRowToExpedienteClienteDatos,
  type SupabaseClienteDatosRow,
} from "./map-supabase-cliente-datos";
import { mapSaveClienteDatosRpcError } from "./save-cliente-datos-rpc-error";
import { ClienteDatosSupabaseError } from "./supabase.error";

const CLIENTE_DATOS_SELECT = `
  expediente_id,
  datos,
  estado,
  comentario_rechazo,
  validated_at,
  validated_by,
  rejected_at,
  rejected_by,
  updated_at,
  referencias,
  updated_by_profile:profiles!cliente_datos_updated_by_fkey ( email )
`;

async function requireSupabaseSession(): Promise<{
  client: SupabaseClient;
}> {
  if (!isSupabaseConfigured() || !supabaseBrowser) {
    throw new ClienteDatosSupabaseError(
      "Supabase no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const client = supabaseBrowser;
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError || !session?.user) {
    throw new ClienteDatosSupabaseError(
      "No hay sesión de Supabase activa. Inicia sesión de nuevo.",
    );
  }

  return { client };
}

/** P3G: lectura RLS + guardado vía RPC `save_cliente_datos`. */
export class SupabaseExpedienteClienteDatosRepo implements ExpedienteClienteDatosRepo {
  async getByExpedienteId(expedienteId: string): Promise<ExpedienteClienteDatos | null> {
    const idNorm = String(expedienteId).trim();
    if (!idNorm) return null;

    const { client } = await requireSupabaseSession();

    const { data, error } = await client
      .from("cliente_datos")
      .select(CLIENTE_DATOS_SELECT)
      .eq("expediente_id", idNorm)
      .maybeSingle();

    if (error) {
      throw new ClienteDatosSupabaseError(
        "No se pudieron cargar los datos del cliente. Intenta de nuevo más tarde.",
      );
    }

    if (!data) return null;

    return mapSupabaseRowToExpedienteClienteDatos(data as SupabaseClienteDatosRow);
  }

  async save(input: SaveExpedienteClienteDatosInput): Promise<ExpedienteClienteDatos> {
    const idNorm = String(input.expedienteId).trim();
    if (!idNorm) {
      throw new ClienteDatosSupabaseError("El identificador del expediente es obligatorio.");
    }

    const { client } = await requireSupabaseSession();
    const rpcArgs = buildSaveClienteDatosRpcPayload(idNorm, input.datos);

    const { error } = await client.rpc("save_cliente_datos", rpcArgs);

    if (error) {
      throw mapSaveClienteDatosRpcError(error);
    }

    const saved = await this.getByExpedienteId(idNorm);
    if (!saved) {
      throw new ClienteDatosSupabaseError(
        "Los datos se guardaron pero no pudieron recargarse. Actualiza la página.",
      );
    }

    return {
      ...saved,
      updatedBy: input.updatedBy || saved.updatedBy,
    };
  }

  async updateEstado(
    _input: UpdateEstadoExpedienteClienteDatosInput,
  ): Promise<ExpedienteClienteDatos | null> {
    void _input;
    throw new ClienteDatosSupabaseError(
      "La validación de datos del cliente solo la realiza Mesa de control en Supabase.",
    );
  }
}
