/** Gates UI: cancelar/reagendar biométricos (P3M.4). */
export function canShowBiometricosManageActions(params: {
  etapaActual: number | null | undefined;
  hasActiveBooking: boolean;
}): boolean {
  return params.etapaActual === 4 && params.hasActiveBooking;
}
