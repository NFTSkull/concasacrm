"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getAvailableFirmaTimeLabelsForDate,
  readAgendaFirmasConfig,
  tryWriteFirmasBooking,
} from "@/lib/agendaFirmasMock";
import type { HhmmTime, YmdDate } from "@/domain/agenda-biometricos";

type Props = Readonly<{
  expedienteId: string;
}>;

/**
 * Agenda de firmas (mock). El padre solo debe montar este bloque si `mock_role === "mesa_control_admin"`.
 * La escritura en `agenda_firmas_bookings_v1` vuelve a validar el rol.
 */
export function AgendaFirmasCard({ expedienteId }: Props) {
  const [dateYmd, setDateYmd] = useState("");
  const [locationId, setLocationId] = useState("");
  const [timeHhmm, setTimeHhmm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tick, setTick] = useState(0);
  void tick;

  const config = readAgendaFirmasConfig();
  const locations = (config?.locations ?? []).filter((l) => l.active !== false);
  const available = locationId
    ? getAvailableFirmaTimeLabelsForDate(dateYmd as YmdDate, locationId, expedienteId)
    : [];

  useEffect(() => {
    if (!okMsg || typeof window === "undefined") return;
    const t = window.setTimeout(() => setOkMsg(null), 6000);
    return () => window.clearTimeout(t);
  }, [okMsg]);

  useEffect(() => {
    const first = locations[0]?.id ?? "";
    if (!locationId || !locations.some((l) => l.id === locationId)) setLocationId(first);
  }, [locationId, locations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAny = () => setTick((t) => t + 1);
    window.addEventListener("agenda_firmas_config_updated", onAny);
    window.addEventListener("agenda_firmas_bookings_v1_updated", onAny);
    return () => {
      window.removeEventListener("agenda_firmas_config_updated", onAny);
      window.removeEventListener("agenda_firmas_bookings_v1_updated", onAny);
    };
  }, []);

  const reservar = useCallback(async () => {
    setError(null);
    setOkMsg(null);
    if (!dateYmd || !timeHhmm || !locationId) {
      setError("Indica ubicación, fecha y hora.");
      return;
    }
    setSubmitting(true);
    try {
      const w = tryWriteFirmasBooking({
        expedienteId,
        dateYmd: dateYmd as YmdDate,
        timeHhmm: timeHhmm as HhmmTime,
        locationId,
      });
      if (!w.ok) {
        setError(w.error);
        return;
      }
      setOkMsg(
        "Reserva de firma guardada. Usa la misma fecha y hora en seguimiento operativo (etapa 9) para persistir la cita.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [dateYmd, expedienteId, locationId, timeHhmm]);

  return (
    <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">
        Agenda de firmas (mock)
      </h3>
      <p className="mt-1 text-[11px] text-gray-600">
        Solo administración de mesa. La cita de firma en etapas 9–10 exige una reserva activa que coincida
        con la fecha y hora.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          type="date"
          label="Fecha de firma"
          value={dateYmd}
          disabled={submitting}
          onChange={(e) => setDateYmd(e.target.value)}
        />
        <label className="text-xs text-gray-700">
          Ubicación
          <select
            className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
            value={locationId}
            disabled={submitting || !locations.length}
            onChange={(e) => {
              setLocationId(e.target.value);
              setTimeHhmm("");
            }}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {available.length === 0 ? (
          <p className="text-[11px] text-gray-500">Sin horarios disponibles para ese día/ubicación.</p>
        ) : (
          available.map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${
                timeHhmm === t
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
              disabled={submitting}
              onClick={() => setTimeHhmm(t)}
            >
              {t}
            </button>
          ))
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {okMsg ? (
        <p className="mt-2 text-xs font-medium text-green-800" role="status">
          {okMsg}
        </p>
      ) : null}
      <div className="mt-3">
        <Button
          type="button"
          variant="primary"
          className="text-xs"
          disabled={submitting}
          onClick={() => void reservar()}
        >
          {submitting ? "Guardando…" : "Reservar horario de firma"}
        </Button>
      </div>
    </section>
  );
}
