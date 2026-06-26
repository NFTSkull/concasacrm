import type { AgendaBiometricosWeeklyConfig } from "@/domain/agenda-biometricos/map-agenda-config";

export type AgendaFirmasWeeklyConfig = AgendaBiometricosWeeklyConfig;

export type AgendaFirmasConfigRecord = Readonly<{
  id: string;
  organizationId: string;
  kind: "firmas";
  config: AgendaFirmasWeeklyConfig;
  updatedAt: string;
  updatedBy: string | null;
}>;

export type UpsertAgendaFirmasConfigResult = Readonly<{
  ok: true;
  agendaConfigId: string;
  organizationId: string;
  kind: "firmas";
  config: AgendaFirmasWeeklyConfig;
  created: boolean;
  updatedAt: string;
  updatedBy: string | null;
  warnings: readonly string[];
}>;

export interface AgendaFirmasConfigRepo {
  getFirmasConfig(): Promise<AgendaFirmasConfigRecord | null>;
  upsertFirmasConfig(config: AgendaFirmasWeeklyConfig): Promise<UpsertAgendaFirmasConfigResult>;
}
