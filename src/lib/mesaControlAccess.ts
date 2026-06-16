import type { ExpedienteMock } from "@/domain/expedientes/mock.repo";

/**
 * Contexto de acceso para Mesa de Control.
 * Usar `getEffectiveMockRole()` para permisos mesa (`mesa_control_*`).
 * `useSessionRepo` expone `mesa_control` como rol de sesión mock para operadores de mesa.
 */
export type MesaControlAccessUser = {
  mockRole: string | null;
};

function effectiveMesaRole(mockRole: string | null): string {
  return String(mockRole ?? "").trim();
}

/**
 * - `mesa_control_admin` → acceso total
 * - `mesa_control_interno` → solo `origenMesa === "interno"`
 * - `mesa_control_externo` → solo `origenMesa === "externo"`
 * - `mesa_control` (legacy mock) → mismo criterio que admin (no romper login actual)
 * - Cualquier otro rol → sin acceso
 */
export function canUserAccessExpediente(
  user: MesaControlAccessUser,
  expediente: ExpedienteMock | null | undefined,
): boolean {
  if (!expediente?.id) return false;
  const role = effectiveMesaRole(user.mockRole);
  if (role === "mesa_control_admin" || role === "mesa_control") return true;
  // Fallback temporal: expedientes sin origen explícito se tratan como internos.
  const origen = expediente.base.origenMesa ?? "interno";
  if (role === "mesa_control_interno") return origen === "interno";
  if (role === "mesa_control_externo") return origen === "externo";
  return false;
}

export function filterExpedientesByRole(
  user: MesaControlAccessUser,
  expedientes: readonly ExpedienteMock[],
): ExpedienteMock[] {
  return expedientes.filter((e) => canUserAccessExpediente(user, e));
}
