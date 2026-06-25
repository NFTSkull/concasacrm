"use client";

import type { AgendaBiometricosActiveBooking } from "@/domain/agenda-biometricos";

export type MesaCitaBiometricosResumenSectionProps = {
  etapaActual: number | null;
  fechaCita?: string | null;
  booking: AgendaBiometricosActiveBooking | null;
  locationLabel?: string | null;
};

function formatBookingDate(dateYmd: string): string {
  try {
    const [y, mo, d] = dateYmd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    if (Number.isNaN(dt.getTime())) return dateYmd;
    return dt.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateYmd;
  }
}

function formatFechaCitaIso(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function MesaCitaBiometricosResumenSection({
  etapaActual,
  fechaCita,
  booking,
  locationLabel,
}: MesaCitaBiometricosResumenSectionProps) {
  if (etapaActual !== 4) return null;

  const hasFecha = typeof fechaCita === "string" && fechaCita.trim() !== "";

  if (!booking && !hasFecha) return null;

  if (!booking && hasFecha) {
    return (
      <section
        className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm"
        aria-label="Cita biométrica"
      >
        <p className="text-sm font-semibold text-amber-950">Cita biométrica</p>
        <p className="mt-2 text-xs text-amber-900">
          Hay fecha de cita registrada ({formatFechaCitaIso(fechaCita!)}), pero no hay reserva
          biométrica activa en Supabase. El asesor debe agendar o verificar la cita.
        </p>
      </section>
    );
  }

  if (!booking) return null;

  const sede = locationLabel?.trim() || booking.locationId;

  return (
    <section
      className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm"
      aria-label="Cita biométrica agendada"
    >
      <p className="text-sm font-semibold text-emerald-900">Cita biométrica agendada</p>
      <dl className="mt-3 grid gap-2 text-xs text-emerald-950 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-emerald-800">Fecha</dt>
          <dd className="mt-0.5">{formatBookingDate(booking.bookingDate)}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Hora</dt>
          <dd className="mt-0.5">{booking.bookingTime}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Sede</dt>
          <dd className="mt-0.5">{sede}</dd>
        </div>
        <div>
          <dt className="font-medium text-emerald-800">Estatus</dt>
          <dd className="mt-0.5 capitalize">{booking.status}</dd>
        </div>
      </dl>
    </section>
  );
}
