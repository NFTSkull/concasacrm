"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapSqlConfigToWeeklyUi,
  mapWeeklyUiToSqlCanonical,
  type AgendaBiometricosWeeklyConfig,
} from "@/domain/agenda-biometricos/map-agenda-config";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";
import type {
  AgendaFirmasConfigRecord,
  AgendaFirmasConfigRepo,
  UpsertAgendaFirmasConfigResult,
} from "./repo";
import { AgendaFirmasSupabaseError } from "./supabase.error";
import { mapUpsertAgendaConfigFirmasRpcError } from "./upsert-agenda-config-rpc-error";

const AGENDA_CONFIG_SELECT = `
  id,
  organization_id,
  kind,
  config,
  updated_at,
  updated_by
`;

type AgendaConfigRow = Readonly<{
  id: string;
  organization_id: string;
  kind: string;
  config: unknown;
  updated_at: string;
  updated_by: string | null;
}>;

type UpsertRpcRow = Readonly<{
  ok?: boolean;
  agenda_config_id?: string;
  organization_id?: string;
  kind?: string;
  config?: unknown;
  created?: boolean;
  updated_at?: string;
  updated_by?: string | null;
  warnings?: unknown;
}>;

async function getCurrentOrganizationId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user?.id) {
    throw new AgendaFirmasSupabaseError(
      "No hay sesión de Supabase activa. Inicia sesión de nuevo.",
    );
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("organization_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id || profile.active === false) {
    throw new AgendaFirmasSupabaseError(
      "No se pudo resolver la organización del usuario activo.",
    );
  }

  return String(profile.organization_id);
}

async function requireSupabaseSession(): Promise<{ client: SupabaseClient }> {
  if (!isSupabaseConfigured() || !supabaseBrowser) {
    throw new AgendaFirmasSupabaseError(
      "Supabase no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const client = supabaseBrowser;
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError || !session?.user) {
    throw new AgendaFirmasSupabaseError(
      "No hay sesión de Supabase activa. Inicia sesión de nuevo.",
    );
  }

  return { client };
}

function mapRowToRecord(row: AgendaConfigRow): AgendaFirmasConfigRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    kind: "firmas",
    config: mapSqlConfigToWeeklyUi(row.config),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapRpcResult(row: UpsertRpcRow): UpsertAgendaFirmasConfigResult {
  if (!row.ok) {
    throw new AgendaFirmasSupabaseError(
      "La RPC no confirmó el guardado de la configuración de firmas.",
    );
  }

  return {
    ok: true,
    agendaConfigId: String(row.agenda_config_id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    kind: "firmas",
    config: mapSqlConfigToWeeklyUi(row.config),
    created: Boolean(row.created),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    updatedBy: row.updated_by ?? null,
    warnings: Array.isArray(row.warnings)
      ? row.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
}

/** P3P.1B: lectura RLS + upsert vía RPC `upsert_agenda_config_firmas`. */
export class SupabaseAgendaFirmasConfigRepo implements AgendaFirmasConfigRepo {
  async getFirmasConfig(): Promise<AgendaFirmasConfigRecord | null> {
    const { client } = await requireSupabaseSession();
    const organizationId = await getCurrentOrganizationId(client);

    const { data, error } = await client
      .from("agenda_config")
      .select(AGENDA_CONFIG_SELECT)
      .eq("kind", "firmas")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      throw new AgendaFirmasSupabaseError(
        "No se pudo cargar la configuración de firmas. Intenta de nuevo más tarde.",
      );
    }

    if (!data) return null;

    return mapRowToRecord(data as AgendaConfigRow);
  }

  async upsertFirmasConfig(
    config: AgendaBiometricosWeeklyConfig,
  ): Promise<UpsertAgendaFirmasConfigResult> {
    const { client } = await requireSupabaseSession();
    const payload = mapWeeklyUiToSqlCanonical(config);

    const { data, error } = await client.rpc("upsert_agenda_config_firmas", {
      p_config: payload,
      p_organization_id: null,
    });

    if (error) {
      throw mapUpsertAgendaConfigFirmasRpcError(error);
    }

    if (!data || typeof data !== "object") {
      throw new AgendaFirmasSupabaseError(
        "Respuesta inválida al guardar la configuración de firmas.",
      );
    }

    return mapRpcResult(data as UpsertRpcRow);
  }
}
