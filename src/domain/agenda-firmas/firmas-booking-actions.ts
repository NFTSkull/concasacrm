/** Gates UI: cancelar/reagendar firmas (P3P.2). */
export function canShowFirmasManageActions(params: {
  etapaActual: number | null | undefined;
  hasActiveBooking: boolean;
}): boolean {
  return params.etapaActual === 9 && params.hasActiveBooking;
}

/** Card asesor Supabase: solo etapa 9, enviado a Mesa. */
export function canShowAsesorFirmasSupabaseCard(params: {
  submittedToMesa: boolean;
  etapaActual: number | null | undefined;
}): boolean {
  return Boolean(params.submittedToMesa && params.etapaActual === 9);
}
