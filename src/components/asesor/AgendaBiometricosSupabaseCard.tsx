"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  AgendaBiometricosSupabaseError,
  buildScheduledAtIso,
  canShowBiometricosManageActions,
  computeWeeklySlotAvailability,
  todayYmdInTimezone,
  useAgendaBiometricosBookingRepo,
  type AgendaBiometricosSlotAvailability,
  type AgendaBiometricosWeeklyConfig,
  type HhmmTime,
  type YmdDate,
} from "@/domain/agenda-biometricos";

export interface AgendaBiometricosSupabaseCardProps {
  expedienteId: string;
  etapaActual?: number | null;
  fechaCita?: string | null;
  onUpdated: () => void;
}

function formatCitaDisplay(iso: string, locationLabel?: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const when = d.toLocaleString("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
    });
    return locationLabel ? `${when} · ${locationLabel}` : when;
  } catch {
    return iso;
  }
}

function addDaysYmd(dateYmd: YmdDate, days: number): YmdDate {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}` as YmdDate;
}

function adjustSlotsForReagendar(
  slots: readonly AgendaBiometricosSlotAvailability[],
  reagendar: boolean,
  activeBooking: { bookingDate: string; bookingTime: string; locationId: string } | null,
  dateYmd: YmdDate,
  locationId: string,
): readonly AgendaBiometricosSlotAvailability[] {
  if (!reagendar || !activeBooking) return slots;
  if (activeBooking.locationId !== locationId || activeBooking.bookingDate !== dateYmd) {
    return slots;
  }
  return slots.map((slot) => {
    if (slot.time !== activeBooking.bookingTime) return slot;
    const bookedCount = Math.max(0, slot.bookedCount - 1);
    const remaining = Math.max(0, slot.capacity - bookedCount);
    return { ...slot, bookedCount, remaining };
  });
}

type SlotPickerProps = {
  config: AgendaBiometricosWeeklyConfig | null;
  locationOptions: AgendaBiometricosWeeklyConfig["locations"];
  locationId: string;
  dateYmd: YmdDate;
  timeHhmm: HhmmTime | "";
  disponibilidadSlots: readonly AgendaBiometricosSlotAvailability[];
  saving: boolean;
  onLocationChange: (id: string) => void;
  onDateChange: (date: YmdDate) => void;
  onTimeChange: (time: HhmmTime) => void;
};

function BiometricosSlotPicker({
  config,
  locationOptions,
  locationId,
  dateYmd,
  timeHhmm,
  disponibilidadSlots,
  saving,
  onLocationChange,
  onDateChange,
  onTimeChange,
}: SlotPickerProps) {
  return (
    <div className="mt-3 space-y-3">
      <label className="block text-[11px] font-semibold text-gray-700">
        Sede
        <select
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          value={locationId}
          onChange={(e) => onLocationChange(e.target.value)}
          disabled={!config?.enabled || saving}
        >
          {locationOptions.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[11px] font-semibold text-gray-700">
        Fecha
        <input
          type="date"
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          value={dateYmd}
          min={config ? todayYmdInTimezone(config.timezone) : undefined}
          onChange={(e) => onDateChange(e.target.value as YmdDate)}
          disabled={saving || !config?.enabled}
        />
      </label>

      <div>
        <p className="text-[11px] font-semibold text-gray-700">Horario</p>
        <p className="mt-0.5 text-[10px] text-gray-500">
          Verde: disponible · Gris: lleno o no permitido
        </p>
        <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/80 p-2">
          {disponibilidadSlots.length === 0 ? (
            <span className="text-[11px] text-gray-500">
              Sin horarios disponibles para esta fecha y sede.
            </span>
          ) : (
            disponibilidadSlots.map((slot) => {
              const lleno = slot.remaining <= 0;
              const selected = timeHhmm === slot.time;
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={lleno || saving}
                  onClick={() => onTimeChange(slot.time)}
                  className={`rounded-md border px-2 py-1 text-left text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed ${
                    lleno
                      ? "border-gray-200 bg-gray-100 text-gray-400"
                      : selected
                        ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                        : "border-emerald-200/80 bg-emerald-50 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100/80"
                  }`}
                >
                  <span className="block">{slot.time}</span>
                  <span className="block text-[9px] font-normal opacity-90">
                    {lleno ? "Lleno" : `${slot.remaining} disp.`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function AgendaBiometricosSupabaseCard({
  expedienteId,
  etapaActual = 4,
  fechaCita,
  onUpdated,
}: AgendaBiometricosSupabaseCardProps) {
  const repo = useAgendaBiometricosBookingRepo();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<AgendaBiometricosWeeklyConfig | null>(null);
  const [activeBooking, setActiveBooking] = useState<Awaited<
    ReturnType<NonNullable<typeof repo>["getActiveBooking"]>
  > | null>(null);
  const [bookedSlots, setBookedSlots] = useState<
    Awaited<ReturnType<NonNullable<typeof repo>["listBookedSlots"]>>
  >([]);
  const [locationId, setLocationId] = useState("");
  const [dateYmd, setDateYmd] = useState<YmdDate>("2026-01-01" as YmdDate);
  const [timeHhmm, setTimeHhmm] = useState<HhmmTime | "">("");
  const [reagendar, setReagendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const locationOptions = useMemo(
    () => (config?.locations ?? []).filter((l) => l.enabled),
    [config],
  );

  const selectedLocation = useMemo(
    () => locationOptions.find((l) => l.id === locationId) ?? null,
    [locationId, locationOptions],
  );

  const puedeGestionar = canShowBiometricosManageActions({
    etapaActual,
    hasActiveBooking: activeBooking != null,
  });

  const load = useCallback(async () => {
    if (!repo) {
      setLoadError("Modo Supabase activo pero el repositorio de agenda no está disponible.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [configRecord, booking] = await Promise.all([
        repo.getBiometricosConfig(),
        repo.getActiveBooking(expedienteId),
      ]);
      const weekly = configRecord?.config ?? null;
      setConfig(weekly);
      setActiveBooking(booking);

      const tz = weekly?.timezone ?? "America/Monterrey";
      const today = todayYmdInTimezone(tz);
      const toDate = addDaysYmd(today, 60);
      const slots = await repo.listBookedSlots({ fromDate: today, toDate });
      setBookedSlots(slots);

      const firstLocation = weekly?.locations.find((l) => l.enabled)?.id ?? "";
      setLocationId((prev) =>
        prev && weekly?.locations.some((l) => l.id === prev && l.enabled) ? prev : firstLocation,
      );
      setDateYmd(today);
      setTimeHhmm("");
      setReagendar(false);
    } catch (err) {
      setLoadError(
        err instanceof AgendaBiometricosSupabaseError
          ? err.message
          : "No se pudo cargar la agenda biométrica.",
      );
    } finally {
      setLoading(false);
    }
  }, [expedienteId, repo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!repo || !config || !locationId) return;
    const today = todayYmdInTimezone(config.timezone);
    const toDate = addDaysYmd(today, 60);
    void repo
      .listBookedSlots({ fromDate: today, toDate, locationId })
      .then(setBookedSlots)
      .catch(() => {
        /* mantener último snapshot */
      });
  }, [config, dateYmd, locationId, repo]);

  const disponibilidadSlots = useMemo(() => {
    if (!config || !locationId) return [];
    const base = computeWeeklySlotAvailability({
      config,
      bookedSlots,
      date: dateYmd,
      locationId,
    });
    return adjustSlotsForReagendar(base, reagendar, activeBooking, dateYmd, locationId);
  }, [activeBooking, bookedSlots, config, dateYmd, locationId, reagendar]);

  const citaIso =
    activeBooking && config
      ? buildScheduledAtIso(
          activeBooking.bookingDate as YmdDate,
          activeBooking.bookingTime as HhmmTime,
          config.timezone,
        )
      : fechaCita && String(fechaCita).trim() !== ""
        ? String(fechaCita)
        : null;

  const locationLabel =
    activeBooking?.locationId
      ? config?.locations.find((l) => l.id === activeBooking.locationId)?.label ??
        activeBooking.locationId
      : undefined;

  const startReagendar = useCallback(() => {
    if (!activeBooking) return;
    setReagendar(true);
    setError(null);
    setSuccessMsg(null);
    setLocationId(activeBooking.locationId);
    setDateYmd(activeBooking.bookingDate as YmdDate);
    setTimeHhmm(activeBooking.bookingTime as HhmmTime);
  }, [activeBooking]);

  const handleCancel = useCallback(async () => {
    if (!repo || !activeBooking) return;
    if (!window.confirm("¿Confirmas cancelar la cita de biométricos?")) return;
    const motivo = window.prompt("Motivo de cancelación (opcional):") ?? "";

    setError(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      await repo.cancelBiometricos({
        expedienteId,
        motivo: motivo.trim() || null,
      });
      setSuccessMsg("Cita de biométricos cancelada.");
      await load();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof AgendaBiometricosSupabaseError
          ? err.message
          : "No se pudo cancelar la cita. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }, [activeBooking, expedienteId, load, onUpdated, repo]);

  const handleBook = useCallback(async () => {
    if (!repo || !config || !locationId || !timeHhmm) return;
    setError(null);
    setSuccessMsg(null);

    const confirmar = window.confirm(
      `¿Confirmas agendar biométricos el ${dateYmd} a las ${timeHhmm} en ${selectedLocation?.label ?? locationId}?`,
    );
    if (!confirmar) return;

    let scheduledAt: string;
    try {
      scheduledAt = buildScheduledAtIso(dateYmd, timeHhmm as HhmmTime, config.timezone);
    } catch {
      setError("Horario inválido.");
      return;
    }

    setSaving(true);
    try {
      await repo.bookBiometricos({
        expedienteId,
        scheduledAt,
        locationId,
      });
      setSuccessMsg("Cita de biométricos agendada correctamente.");
      await load();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof AgendaBiometricosSupabaseError
          ? err.message
          : "No se pudo agendar la cita. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    config,
    dateYmd,
    expedienteId,
    load,
    locationId,
    onUpdated,
    repo,
    selectedLocation?.label,
    timeHhmm,
  ]);

  const handleReagendar = useCallback(async () => {
    if (!repo || !config || !locationId || !timeHhmm || !activeBooking) return;
    setError(null);
    setSuccessMsg(null);

    const confirmar = window.confirm(
      `¿Confirmas reagendar biométricos al ${dateYmd} a las ${timeHhmm} en ${selectedLocation?.label ?? locationId}?`,
    );
    if (!confirmar) return;

    let scheduledAt: string;
    try {
      scheduledAt = buildScheduledAtIso(dateYmd, timeHhmm as HhmmTime, config.timezone);
    } catch {
      setError("Horario inválido.");
      return;
    }

    setSaving(true);
    try {
      await repo.reagendarBiometricos({
        expedienteId,
        scheduledAt,
        locationId,
      });
      setSuccessMsg("Cita de biométricos reagendada correctamente.");
      await load();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof AgendaBiometricosSupabaseError
          ? err.message
          : "No se pudo reagendar la cita. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    activeBooking,
    config,
    dateYmd,
    expedienteId,
    load,
    locationId,
    onUpdated,
    repo,
    selectedLocation?.label,
    timeHhmm,
  ]);

  const renderFormShell = (
    title: string,
    subtitle: string,
    submitLabel: string,
    onSubmit: () => void,
    extraActions?: ReactNode,
  ) => (
    <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-gray-600">{subtitle}</p>

      {!config || !config.enabled || locationOptions.length === 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          La agenda biométrica aún no está configurada o está deshabilitada. Solicita a Mesa Admin
          que configure sedes, días y horarios.
        </p>
      ) : null}

      {successMsg ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-950"
        >
          {successMsg}
        </p>
      ) : null}

      <BiometricosSlotPicker
        config={config}
        locationOptions={locationOptions}
        locationId={locationId}
        dateYmd={dateYmd}
        timeHhmm={timeHhmm}
        disponibilidadSlots={disponibilidadSlots}
        saving={saving}
        onLocationChange={(id) => {
          setLocationId(id);
          setTimeHhmm("");
          setError(null);
        }}
        onDateChange={(date) => {
          setDateYmd(date);
          setTimeHhmm("");
          setError(null);
        }}
        onTimeChange={(time) => {
          setTimeHhmm(time);
          setError(null);
        }}
      />

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {extraActions}

      <Button
        type="button"
        variant="primary"
        className="mt-4 w-full text-xs"
        disabled={
          saving ||
          !config?.enabled ||
          !locationId ||
          !timeHhmm ||
          disponibilidadSlots.every((s) => s.remaining <= 0)
        }
        onClick={() => void onSubmit()}
      >
        {saving ? "Guardando…" : submitLabel}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-sky-200 bg-white p-4 text-sm text-gray-600">
        Cargando agenda biométricos…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {loadError}
      </div>
    );
  }

  if (reagendar && puedeGestionar) {
    return renderFormShell(
      "Reagendar cita de biométricos",
      "Elige nueva sede, fecha y hora según la agenda configurada por Mesa.",
      "Confirmar reagendar",
      handleReagendar,
      (
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full text-xs"
          disabled={saving}
          onClick={() => {
            setReagendar(false);
            setError(null);
            setTimeHhmm("");
          }}
        >
          Cancelar reagendar
        </Button>
      ),
    );
  }

  if (puedeGestionar && citaIso) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
        <p className="text-sm font-semibold text-emerald-900">Cita de biométricos agendada</p>
        <p className="mt-2 text-xs text-emerald-950">
          <span className="font-medium">Fecha y hora:</span>{" "}
          {formatCitaDisplay(citaIso, locationLabel)}
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          <span className="font-medium">Estatus:</span> Cita agendada — etapa 4 (sin avance automático)
        </p>

        {successMsg ? (
          <p
            role="status"
            className="mt-3 rounded-md border border-emerald-300 bg-white/80 px-3 py-2 text-xs font-medium text-emerald-950"
          >
            {successMsg}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 text-xs"
            disabled={saving}
            onClick={() => void startReagendar()}
          >
            Reagendar cita
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 text-xs"
            disabled={saving}
            onClick={() => void handleCancel()}
          >
            {saving ? "Procesando…" : "Cancelar cita"}
          </Button>
        </div>
      </div>
    );
  }

  if (citaIso && !activeBooking) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
        <p className="text-sm font-semibold text-amber-950">Cita biométrica registrada</p>
        <p className="mt-2 text-xs text-amber-900">
          Hay fecha de cita ({formatCitaDisplay(citaIso)}), pero no hay reserva activa en Supabase.
          Agenda de nuevo si corresponde.
        </p>
      </div>
    );
  }

  return renderFormShell(
    "Agendar cita de biométricos",
    "Horarios y cupos según la agenda semanal configurada por Mesa en Supabase.",
    "Agendar cita biométrica",
    handleBook,
  );
}
