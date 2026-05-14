"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MockExpedientesRepo } from "@/domain/expedientes/mock.repo";
import type { HhmmTime, YmdDate } from "@/domain/agenda-biometricos";
import {
  getAgendaFirmasDisponibilidad,
  readAgendaFirmasBookings,
  readAgendaFirmasConfig,
  tryWriteFirmasBooking,
} from "@/lib/agendaFirmasMock";

type Props = Readonly<{
  expedienteId: string;
  submittedToMesa: boolean;
  etapaActual: number | null;
  fechaCita: string | null | undefined;
  repo: MockExpedientesRepo;
  onUpdated: () => void;
}>;

function currentYmd(): YmdDate {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` as YmdDate;
}

function formatCitaDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
}

export function AgendaFirmasAsesorCard({
  expedienteId,
  submittedToMesa,
  etapaActual,
  fechaCita,
  repo,
  onUpdated,
}: Props) {
  const [configTick, setConfigTick] = useState(0);
  const [bookingsTick, setBookingsTick] = useState(0);
  const config = useMemo(() => {
    void configTick;
    return readAgendaFirmasConfig();
  }, [configTick]);
  const locationOptions = useMemo(
    () => (config?.locations ?? []).filter((l) => l.active !== false),
    [config],
  );
  const [locationId, setLocationId] = useState("");
  const [dateYmd, setDateYmd] = useState<YmdDate>(currentYmd());
  const [timeHhmm, setTimeHhmm] = useState<HhmmTime | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [reagendar, setReagendar] = useState(false);

  useEffect(() => {
    const first = locationOptions[0]?.id ?? "";
    setLocationId((prev) => (prev && locationOptions.some((l) => l.id === prev) ? prev : first));
  }, [locationOptions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onConfig = () => setConfigTick((t) => t + 1);
    const onBookings = () => setBookingsTick((t) => t + 1);
    window.addEventListener("agenda_firmas_config_updated", onConfig);
    window.addEventListener("agenda_firmas_bookings_v1_updated", onBookings);
    return () => {
      window.removeEventListener("agenda_firmas_config_updated", onConfig);
      window.removeEventListener("agenda_firmas_bookings_v1_updated", onBookings);
    };
  }, []);

  const disponibilidad = useMemo(() => {
    void bookingsTick;
    if (!config || !locationId) return [];
    const bookings = readAgendaFirmasBookings();
    return getAgendaFirmasDisponibilidad({
      config,
      bookings: bookings.bookings,
      date: dateYmd,
      locationId,
      excludeExpedienteId: expedienteId,
    });
  }, [bookingsTick, config, dateYmd, expedienteId, locationId]);

  const bookingActivo = useMemo(() => {
    void bookingsTick;
    const bookings = readAgendaFirmasBookings();
    return [...bookings.bookings]
      .reverse()
      .find((b) => b.status === "booked" && String(b.expedienteId ?? "").trim() === expedienteId);
  }, [bookingsTick, expedienteId]);

  const etapa = etapaActual ?? 0;
  const tieneCita = Boolean(
    (bookingActivo && bookingActivo.status === "booked") ||
      (fechaCita && String(fechaCita).trim() !== ""),
  );
  const mostrarBloque = submittedToMesa && (etapa === 9 || etapa === 10);
  const puedeAgendar = (etapa === 9 && !tieneCita) || reagendar;

  async function onConfirmar() {
    setError(null);
    setOkMsg(null);
    if (!locationId) {
      setError("Selecciona una ubicación.");
      return;
    }
    if (!timeHhmm) {
      setError("Selecciona un horario con cupo.");
      return;
    }
    setLoading(true);
    const write = tryWriteFirmasBooking({
      expedienteId,
      dateYmd,
      timeHhmm: timeHhmm as HhmmTime,
      locationId,
    });
    if (!write.ok) {
      setLoading(false);
      setError(write.error);
      return;
    }
    try {
      await repo.updateOperativo(expedienteId, {
        etapaActual: 10,
        subestado: "en_proceso",
        fechaCita: write.iso,
        submittedToMesa: true,
        motivoRechazo: null,
        comentarioRechazo: null,
        updatedAt: new Date().toISOString(),
      });
      setReagendar(false);
      setOkMsg(
        etapa === 10
          ? "Cita de firma reagendada correctamente."
          : "Cita de firma guardada. El expediente pasó a etapa 10.",
      );
      onUpdated();
    } catch {
      write.rollback();
      setError("No se pudo guardar la cita de firma.");
    } finally {
      setLoading(false);
    }
  }

  if (!mostrarBloque) return null;

  const locationLabel =
    bookingActivo && config
      ? config.locations.find((l) => l.id === String(bookingActivo.locationId ?? ""))?.label ??
        String(bookingActivo.locationId ?? "—")
      : "—";

  if (tieneCita && !reagendar) {
    return (
      <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 shadow-sm">
        <p className="text-sm font-semibold text-violet-950">Cita de firma agendada</p>
        <p className="mt-1 text-xs text-violet-900">
          {bookingActivo?.date && bookingActivo?.time
            ? `${bookingActivo.date} ${bookingActivo.time}`
            : formatCitaDisplay(String(fechaCita ?? ""))}
        </p>
        <p className="mt-1 text-xs text-violet-900">
          <span className="font-medium">Ubicación:</span> {locationLabel}
        </p>
        <p className="text-xs text-violet-900">
          <span className="font-medium">Estado:</span> {bookingActivo?.status ?? "booked"}
        </p>
        {bookingActivo?.createdAt ? (
          <p className="text-xs text-violet-900">
            <span className="font-medium">Creada:</span> {formatCitaDisplay(bookingActivo.createdAt)}
          </p>
        ) : null}
        {bookingActivo?.updatedAt ? (
          <p className="text-xs text-violet-900">
            <span className="font-medium">Actualizada:</span> {formatCitaDisplay(bookingActivo.updatedAt)}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-3 text-xs"
          onClick={() => {
            setReagendar(true);
            if (bookingActivo?.locationId) setLocationId(String(bookingActivo.locationId));
            if (bookingActivo?.date) setDateYmd(bookingActivo.date as YmdDate);
            if (bookingActivo?.time) setTimeHhmm(bookingActivo.time as HhmmTime);
            setError(null);
            setOkMsg(null);
          }}
        >
          Reagendar cita de firma
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">
        {reagendar ? "Reagendar cita de firma" : "Agendar cita de firma"}
      </p>
      {!config ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          No hay configuración de firmas (`agenda_firmas_config_v1`). Cynthia debe configurar
          horarios y cupos.
        </p>
      ) : null}
      {!puedeAgendar ? (
        <p className="mt-2 text-[11px] text-gray-600">
          Solo puedes agendar firma cuando el expediente está en etapa 9 sin cita.
        </p>
      ) : null}
      {reagendar ? (
        <button
          type="button"
          className="mt-2 text-[11px] font-medium text-violet-700 underline"
          onClick={() => {
            setReagendar(false);
            setError(null);
          }}
        >
          Cancelar reagenda
        </button>
      ) : null}
      <div className="mt-3 space-y-2">
        <label className="block text-[11px] font-semibold text-gray-700">
          Ubicación
          <select
            className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setTimeHhmm("");
            }}
            disabled={!config || !puedeAgendar || loading}
          >
            {(locationOptions.length ? locationOptions : [{ id: "", label: "Sin ubicación" }]).map((l) => (
              <option key={l.id || "none"} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-gray-700">
          Fecha
          <input
            type="date"
            value={dateYmd}
            onChange={(e) => {
              setDateYmd(e.target.value as YmdDate);
              setTimeHhmm("");
            }}
            className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
            disabled={!puedeAgendar || loading}
          />
        </label>
        <div>
          <p className="text-[11px] font-semibold text-gray-700">Horario</p>
          <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/80 p-2">
            {disponibilidad.length === 0 ? (
              <span className="text-[11px] text-gray-500">Sin slots configurados para firma.</span>
            ) : (
              disponibilidad.map((slot) => {
                const lleno = slot.remaining <= 0;
                const selected = timeHhmm === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={lleno || !puedeAgendar || loading}
                    onClick={() => setTimeHhmm(slot.time as HhmmTime)}
                    className={`rounded-md border px-2 py-1 text-left text-[11px] ${
                      lleno
                        ? "border-gray-200 bg-gray-100 text-gray-400"
                        : selected
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-violet-200 bg-violet-50 text-violet-950"
                    }`}
                  >
                    <span className="block">{slot.time}</span>
                    <span className="block text-[9px]">{lleno ? "Lleno" : `${slot.remaining} disp.`}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {okMsg ? <p className="mt-2 text-xs font-medium text-emerald-700">{okMsg}</p> : null}
      <Button
        type="button"
        variant="primary"
        className="mt-3 w-full text-xs"
        disabled={!config || !puedeAgendar || !timeHhmm || loading}
        onClick={() => void onConfirmar()}
      >
        {loading ? "Guardando…" : reagendar ? "Confirmar nueva cita" : "Confirmar cita"}
      </Button>
    </section>
  );
}

