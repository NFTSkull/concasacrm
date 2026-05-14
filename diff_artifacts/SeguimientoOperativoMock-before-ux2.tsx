"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type EstadoEtapa = "pendiente" | "en_proceso" | "aprobado" | "rechazado";
type RolMock = "asesor" | "mesa_control";

interface Etapa {
  id: number;
  nombre: string;
  sla?: string;
}

const ETAPAS: Etapa[] = [
  { id: 1, nombre: "Integración", sla: "SLA 2 días" },
  { id: 2, nombre: "Registro", sla: "SLA 2 días" },
  { id: 3, nombre: "Listo para cita de biométrico" },
  { id: 4, nombre: "Cita agendada (biométricos)" },
  { id: 5, nombre: "Biometría (resultado)" },
  { id: 6, nombre: "Inscripción" },
  { id: 7, nombre: "Notificación" },
  { id: 8, nombre: "Acuse / Aviso de retención" },
  { id: 9, nombre: "Listo para agendar firma" },
  { id: 10, nombre: "Cita para firma" },
  { id: 11, nombre: "Firmado" },
  { id: 12, nombre: "Pago a ConCasa" },
];

function getEtapaNombre(id: number | null | undefined): string {
  if (id == null) return "Etapa desconocida";
  const etapa = ETAPAS.find((e) => e.id === id);
  return etapa?.nombre ?? `Etapa ${id}`;
}

type MotivoOption = {
  value: string;
  label: string;
};

const MOTIVOS_POR_ETAPA: Record<number, MotivoOption[]> = {
  1: [
    { value: "direccion_repetida", label: "Dirección repetida" },
    { value: "ine_ilegible", label: "INE ilegible" },
    { value: "edo_cuenta_no_actualizado", label: "Estado de cuenta no actualizado" },
    { value: "nss_equivocado", label: "NSS equivocado" },
    { value: "ine_vencida", label: "INE vencida" },
  ],
  2: [
    {
      value: "registrado_otro_proveedor",
      label: "Registrado con otro proveedor",
    },
  ],
  3: [
    { value: "huellas_ilegibles", label: "Huellas ilegibles" },
    { value: "no_actualizada_afore", label: "No actualizada en AFORE" },
    { value: "no_acudio", label: "No acudió" },
    { value: "rfc_error", label: "RFC con error" },
    { value: "curp_equivocada", label: "CURP equivocada" },
    { value: "cp_diferente", label: "Código postal diferente" },
    { value: "credito_vigente", label: "Crédito vigente" },
    { value: "mal_buro", label: "Mal buró" },
    { value: "problemas_legales", label: "Problemas legales" },
    { value: "usurpacion_identidad", label: "Usurpación de identidad" },
  ],
  4: [
    { value: "huellas_ilegibles", label: "Huellas ilegibles" },
    { value: "no_actualizada_afore", label: "No actualizada en AFORE" },
    { value: "no_acudio", label: "No acudió" },
    { value: "rfc_error", label: "RFC con error" },
    { value: "curp_equivocada", label: "CURP equivocada" },
    { value: "cp_diferente", label: "Código postal diferente" },
    { value: "credito_vigente", label: "Crédito vigente" },
    { value: "mal_buro", label: "Mal buró" },
    { value: "problemas_legales", label: "Problemas legales" },
    { value: "usurpacion_identidad", label: "Usurpación de identidad" },
  ],
  5: [
    { value: "huellas_ilegibles", label: "Huellas ilegibles" },
    { value: "no_actualizada_afore", label: "No actualizada en AFORE" },
    { value: "no_acudio", label: "No acudió" },
    { value: "rfc_error", label: "RFC con error" },
    { value: "curp_equivocada", label: "CURP equivocada" },
    { value: "cp_diferente", label: "Código postal diferente" },
    { value: "credito_vigente", label: "Crédito vigente" },
    { value: "mal_buro", label: "Mal buró" },
    { value: "problemas_legales", label: "Problemas legales" },
    { value: "usurpacion_identidad", label: "Usurpación de identidad" },
  ],
  7: [{ value: "notificacion_vencida", label: "Notificación vencida" }],
  9: [
    { value: "no_agendo_segunda_cita", label: "No agendó la segunda cita" },
    { value: "no_vino", label: "No vino" },
  ],
  10: [
    { value: "no_asistio", label: "No asistió" },
    { value: "no_habia_sistema", label: "No había sistema" },
    { value: "vino_sin_ine", label: "Vino sin INE" },
  ],
  12: [
    {
      value: "cliente_no_quiere_pagar",
      label: "Cliente no quiere pagar",
    },
  ],
};

type Abogado = "elis" | "roberto";
type DocKey = "ine" | "estado_cuenta" | "nss" | "direccion";

interface DocState {
  checked: boolean;
  notes: string;
}

interface EstadoEtapaDetallado {
  estado: EstadoEtapa;
  motivo?: string;
  notasInternas: string;
  fechaCita?: string;
  fechaLiberacion?: string;
  abogadoAsignado?: Abogado;
  ultimaActualizacion: string;
}

type TimelineState = Record<number, EstadoEtapaDetallado>;

const ESTADO_INICIAL: TimelineState = {};

interface ChecklistItemProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

function ChecklistItem({
  label,
  checked,
  onCheckedChange,
  notes,
  onNotesChange,
}: ChecklistItemProps) {
  // UI compacta: el textarea de notas se expande solo cuando hay notas o cuando el usuario lo solicita.
  const [notesOpen, setNotesOpen] = useState<boolean>(() => notes.trim().length > 0);
  const hasNotes = notes.trim().length > 0;

  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            id={`chk-${label}`}
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
          />
          <label htmlFor={`chk-${label}`} className="text-sm font-medium text-gray-900">
            {label}
          </label>
          {checked && (
            <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
              Completado
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-expanded={notesOpen}
        >
          {notesOpen ? "Ocultar notas" : hasNotes ? "Ver notas" : "Notas"}
        </button>
      </div>

      {notesOpen && (
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Notas..."
          className="mt-2 h-20 w-full resize-none rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
    </div>
  );
}

function getEstadoLabel(estado: EstadoEtapa): string {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "en_proceso":
      return "En proceso";
    case "aprobado":
      return "Aprobado";
    case "rechazado":
      return "Rechazado";
    default:
      return estado;
  }
}

type StageVisualStatus = "completed" | "current" | "pending" | "rejected";

function getStageVisualStatus(
  stageId: number,
  etapaActualId: number,
  subestado: EstadoEtapa,
): StageVisualStatus {
  if (stageId < etapaActualId) {
    return "completed";
  }
  if (stageId > etapaActualId) {
    return "pending";
  }
  // stageId === etapaActualId
  if (subestado === "rechazado") return "rejected";
  if (subestado === "aprobado") return "completed";
  if (subestado === "en_proceso") return "current";
  return "pending";
}

function formatFecha(fechaIso?: string): string {
  if (!fechaIso) return "—";
  try {
    const d = new Date(fechaIso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "—";
  }
}

export interface SeguimientoOperativoMockSummary {
  etapaActualId: number;
  subestado: EstadoEtapa;
  motivo?: string;
  fechaCita?: string;
}

export interface SeguimientoOperativoMockProps {
  initialSubmittedToMesa?: boolean;
  initialEtapaActualId?: number;
  initialSubestado?: EstadoEtapa;
  initialMotivo?: string;
  initialFechaCita?: string;
  initialUpdatedAt?: string;
  onChangeSummary?: (summary: SeguimientoOperativoMockSummary) => void;
  /**
   * Persistencia real del "Enviar a mesa de control".
   * El componente no debe escribir en localStorage para mesa; lo hace el repo vía callback.
   */
  onEnviarAMesa?: (payload: {
    id: string;
    cliente_nombre: string;
    telefono_cliente: string;
    programa: string;
    asesorNombre: string;
    // Al enviar desde asesor, NO se debe requerir cita.
    // La cita se captura en mesa-control en etapas específicas (3 y 9).
    fechaCita?: string | null;
    etapaActual?: number;
    subestado?: EstadoEtapa;
    docs?: unknown;
  }) => Promise<void> | void;
  contextPrecalId?: string;
  contextClienteNombre?: string;
  contextTelefono?: string;
  contextPrograma?: string;
  contextAsesorId?: string;
}

export function SeguimientoOperativoMock(props: SeguimientoOperativoMockProps = {}) {
  const {
    initialSubmittedToMesa,
    initialEtapaActualId,
    initialSubestado,
    initialMotivo,
    initialFechaCita,
    initialUpdatedAt,
    onChangeSummary,
    onEnviarAMesa,
    contextPrecalId,
    contextClienteNombre,
    contextTelefono,
    contextPrograma,
    contextAsesorId,
  } = props;

  const [timeline, setTimeline] = useState<TimelineState>(() => {
    if (initialEtapaActualId != null && initialSubestado != null) {
      return {
        [initialEtapaActualId]: {
          estado: initialSubestado,
          motivo: initialMotivo,
          fechaCita: initialFechaCita,
          ultimaActualizacion: initialUpdatedAt ?? new Date().toISOString(),
          notasInternas: "",
        },
      };
    }
    return ESTADO_INICIAL;
  });
  const [etapaActualId, setEtapaActualId] = useState<number>(initialEtapaActualId ?? 1);
  const [currentRole, setCurrentRole] = useState<RolMock>("asesor");
  const [submittedToMesa, setSubmittedToMesa] = useState(initialSubmittedToMesa ?? false);
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    ine: { checked: false, notes: "" },
    estado_cuenta: { checked: false, notes: "" },
    nss: { checked: false, notes: "" },
    direccion: { checked: false, notes: "" },
  });
  const [docsWarning, setDocsWarning] = useState<string | null>(null);
  const [operativoWarning, setOperativoWarning] = useState<string | null>(null);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState<string>("");
  const [notaRechazo, setNotaRechazo] = useState<string>("");
  const [fechaCita, setFechaCita] = useState<string>("");
  const [fechaLiberacion, setFechaLiberacion] = useState<string>("");
  const [abogadoAsignado, setAbogadoAsignado] = useState<Abogado | "">("");
  const [hideRoleSwitch, setHideRoleSwitch] = useState(false);
  const [aprobadoConMonto, setAprobadoConMonto] = useState<boolean>(false);
  const [canUseMesaRole, setCanUseMesaRole] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mockRole = window.localStorage.getItem("mock_role");
    if (mockRole === "mesa_control") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentRole("mesa_control");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHideRoleSwitch(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanUseMesaRole(true);
    } else if (mockRole === "asesor") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentRole("asesor");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHideRoleSwitch(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanUseMesaRole(false);
    }
  }, []);

  // Sincroniza la timeline con el estado operativo real cuando se usa en visión asesor
  useEffect(() => {
    if (currentRole !== "asesor") return;
    if (initialEtapaActualId == null || !initialSubestado) return;
    const now = initialUpdatedAt ?? new Date().toISOString();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeline(() => {
      const base: TimelineState = {};
      ETAPAS.forEach((etapa) => {
        if (etapa.id < initialEtapaActualId) {
          base[etapa.id] = {
            estado: "aprobado",
            motivo: undefined,
            notasInternas: "",
            fechaCita:
              etapa.id === 3 || etapa.id === 9 ? initialFechaCita : undefined,
            fechaLiberacion: undefined,
            abogadoAsignado: undefined,
            ultimaActualizacion: now,
          };
        } else if (etapa.id === initialEtapaActualId) {
          base[etapa.id] = {
            estado: initialSubestado,
            motivo: initialMotivo,
            notasInternas: "",
            fechaCita: initialFechaCita,
            fechaLiberacion: undefined,
            abogadoAsignado: undefined,
            ultimaActualizacion: now,
          };
        }
      });
      return base;
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtapaActualId(initialEtapaActualId);
  }, [
    currentRole,
    initialEtapaActualId,
    initialSubestado,
    initialMotivo,
    initialFechaCita,
    initialUpdatedAt,
  ]);

  const loadDecisionFromMock = () => {
    if (typeof window === "undefined") return;
    if (!contextPrecalId) {
      setAprobadoConMonto(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem("decisions_mock");
      if (!raw) {
        setAprobadoConMonto(false);
        return;
      }
      const parsed = JSON.parse(raw) as unknown[];
      const found = parsed.find((d) => {
        if (!d || typeof d !== "object") return false;
        const obj = d as Record<string, unknown>;
        return obj.idPrecal === contextPrecalId;
      });
      if (!found) {
        setAprobadoConMonto(false);
        return;
      }
      const obj = found as Record<string, unknown>;
      const decision = obj.decision;
      const monto = obj.monto_aprobado;
      const ok = decision === "aprobado" && typeof monto === "number";
      setAprobadoConMonto(ok);
    } catch (err) {
      console.error(
        "[seguimiento] error leyendo decisions_mock:",
        err instanceof Error ? err.message : String(err),
      );
      setAprobadoConMonto(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDecisionFromMock();
  }, [contextPrecalId]);

  useEffect(() => {
    if (typeof window === "undefined" || !contextPrecalId) return;
    const handler = (e: StorageEvent) => {
      if (e.key === "decisions_mock") {
        loadDecisionFromMock();
      }
    };
    const customHandler = () => {
      loadDecisionFromMock();
    };
    window.addEventListener("storage", handler);
    window.addEventListener("decisions_mock_updated", customHandler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("decisions_mock_updated", customHandler);
    };
  }, [contextPrecalId]);

  const etapaActual = useMemo(
    () => ETAPAS.find((e) => e.id === etapaActualId) ?? ETAPAS[0],
    [etapaActualId]
  );

  const estadoActual = timeline[etapaActual.id] ?? {
    estado: "pendiente" as EstadoEtapa,
    notasInternas: "",
    ultimaActualizacion: "",
  };

  const motivosDisponibles = MOTIVOS_POR_ETAPA[etapaActual.id] ?? [];

  const ultimaActualizacionGlobal = useMemo(() => {
    const fechas = Object.values(timeline)
      .map((e) => e.ultimaActualizacion)
      .filter(Boolean);
    if (fechas.length === 0) return undefined;
    return fechas.sort().slice(-1)[0];
  }, [timeline]);

  /** Valor a mostrar en "Última actualización": prioriza el dato real del expediente (mesa_control_inbox) sobre el estado interno del timeline. */
  const ultimaActualizacionDisplay = initialUpdatedAt ?? ultimaActualizacionGlobal;

  /** Solo Mesa de Control puede cambiar de etapa al hacer click en la timeline. El asesor ve solo lectura. */
  const canInteractTimeline = currentRole === "mesa_control";

  const subestado = useMemo(() => {
    return getEstadoLabel(estadoActual.estado);
  }, [estadoActual.estado]);

  useEffect(() => {
    if (!onChangeSummary) return;
    const estado = timeline[etapaActualId] ?? {
      estado: "pendiente" as EstadoEtapa,
      motivo: undefined,
      fechaCita: undefined,
    };
    onChangeSummary({
      etapaActualId,
      subestado: estado.estado,
      motivo: estado.motivo,
      fechaCita: estado.fechaCita,
    });
  }, [onChangeSummary, timeline, etapaActualId]);

  const handleMarcarEnProceso = () => {
    if (currentRole !== "mesa_control" || !submittedToMesa) return;
    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        estado: "en_proceso",
        ultimaActualizacion: new Date().toISOString(),
        notasInternas: prev[etapaActual.id]?.notasInternas ?? "",
      },
    }));
  };

  const handleAprobarYSiguiente = () => {
    if (currentRole !== "mesa_control" || !submittedToMesa) return;

    // Reglas de negocio: para avanzar a la etapa de "cita agendada"
    // primero se debe capturar la cita en la etapa previa.
    if (etapaActual.id === 3) {
      const fechaBio = timeline[3]?.fechaCita;
      if (!fechaBio) {
        setOperativoWarning(
          "Para pasar a la etapa 4 (Cita agendada), captura primero la cita de biométricos en la etapa 3."
        );
        return;
      }
    }
    if (etapaActual.id === 9) {
      const fechaFirma = timeline[9]?.fechaCita;
      if (!fechaFirma) {
        setOperativoWarning(
          "Para pasar a la etapa 10 (Cita para firma), captura primero la cita de firma en la etapa 9."
        );
        return;
      }
    }

    setOperativoWarning(null);
    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        estado: "aprobado",
        ultimaActualizacion: new Date().toISOString(),
        notasInternas: prev[etapaActual.id]?.notasInternas ?? "",
      },
    }));
    const siguiente = ETAPAS.find((e) => e.id === etapaActual.id + 1);
    if (siguiente) {
      setEtapaActualId(siguiente.id);
    }
  };

  const handleGuardarNotas = (value: string) => {
    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        notasInternas: value,
        ultimaActualizacion:
          prev[etapaActual.id]?.ultimaActualizacion ?? new Date().toISOString(),
      },
    }));
  };

  const abrirModalRechazo = () => {
    if (currentRole !== "mesa_control" || !submittedToMesa) return;
    setMotivoRechazo("");
    setNotaRechazo("");
    setShowRechazoModal(true);
  };

  const cerrarModalRechazo = () => {
    setShowRechazoModal(false);
  };

  const handleConfirmarRechazo = () => {
    if (!motivoRechazo) return;

    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        estado: "rechazado",
        motivo: motivoRechazo,
        notasInternas:
          (prev[etapaActual.id]?.notasInternas ?? "") +
          (notaRechazo ? `\n[Rechazo] ${notaRechazo}` : ""),
        fechaCita:
          etapaActual.id === 3 || etapaActual.id === 9
            ? fechaCita || prev[etapaActual.id]?.fechaCita
            : prev[etapaActual.id]?.fechaCita,
        fechaLiberacion:
          etapaActual.id === 2 && motivoRechazo === "registrado_otro_proveedor"
            ? fechaLiberacion || prev[etapaActual.id]?.fechaLiberacion
            : prev[etapaActual.id]?.fechaLiberacion,
        abogadoAsignado:
          etapaActual.id === 12 && motivoRechazo === "cliente_no_quiere_pagar"
            ? (abogadoAsignado || prev[etapaActual.id]?.abogadoAsignado)
            : prev[etapaActual.id]?.abogadoAsignado,
        ultimaActualizacion: new Date().toISOString(),
      },
    }));
    setShowRechazoModal(false);
  };

  const handleFechaCitaChange = (value: string) => {
    if (currentRole !== "mesa_control" || !submittedToMesa) return;
    setOperativoWarning(null);
    setFechaCita(value);
    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        fechaCita: value,
        ultimaActualizacion: new Date().toISOString(),
      },
    }));
  };

  const handleFechaLiberacionChange = (value: string) => {
    if (currentRole !== "mesa_control" || !submittedToMesa) return;
    setFechaLiberacion(value);
    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        fechaLiberacion: value,
        ultimaActualizacion: new Date().toISOString(),
      },
    }));
  };

  const handleAbogadoChange = (value: Abogado | "") => {
    setAbogadoAsignado(value);
    if (!value) return;
    if (currentRole !== "mesa_control" || !submittedToMesa) return;
    setTimeline((prev) => ({
      ...prev,
      [etapaActual.id]: {
        ...prev[etapaActual.id],
        abogadoAsignado: value,
        ultimaActualizacion: new Date().toISOString(),
      },
    }));
  };

  // La captura de la cita ocurre en:
  // - etapa 3: cita biométricos
  // - etapa 9: cita para firma
  const isEtapaConFechaCita = etapaActual.id === 3 || etapaActual.id === 9;
  const isEtapaConFechaLiberacion =
    etapaActual.id === 2 && motivoRechazo === "registrado_otro_proveedor";
  const isEtapaConAbogado =
    etapaActual.id === 12 && motivoRechazo === "cliente_no_quiere_pagar";

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Seguimiento Operativo (mock)
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Información en memoria solo para pruebas de flujo. No se guarda en BD.
          </p>
        </div>
        {!hideRoleSwitch && canUseMesaRole && (
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-gray-50 px-2 py-1 text-xs md:self-auto">
            <span className="text-gray-500">Rol (mock):</span>
            <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setCurrentRole("asesor")}
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  currentRole === "asesor"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700"
                }`}
              >
                Asesor
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canUseMesaRole) return;
                  setCurrentRole("mesa_control");
                }}
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  currentRole === "mesa_control"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700"
                }`}
              >
                Mesa de control
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Resumen superior compacto */}
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Etapa actual
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {etapaActual.id}. {etapaActual.nombre}
            </p>
            {etapaActual.sla && (
              <p className="mt-0.5 text-[11px] text-yellow-700">{etapaActual.sla}</p>
            )}
            {(estadoActual.fechaCita ?? (isEtapaConFechaCita ? fechaCita : undefined)) && (
              <p className="mt-1 text-[11px] text-gray-700">
                <span className="font-semibold">Cita:</span>{" "}
                {formatFecha(estadoActual.fechaCita ?? fechaCita)}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Subestado / Estatus
            </p>
            <div className="mt-1">
              {estadoActual.estado === "rechazado" ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 border border-red-200">
                  {subestado}
                </span>
              ) : estadoActual.estado === "aprobado" ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
                  {subestado}
                </span>
              ) : estadoActual.estado === "en_proceso" ? (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200">
                  {subestado}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                  {subestado}
                </span>
              )}
            </div>

            {estadoActual.estado === "rechazado" && estadoActual.motivo && (
              <p className="mt-1 text-[11px] text-red-700">
                <span className="font-semibold">Motivo:</span>{" "}
                {motivosDisponibles.find((m) => m.value === estadoActual.motivo)?.label ??
                  estadoActual.motivo}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Estado de envío
            </p>
            <div className="mt-1">
              {submittedToMesa ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
                  En mesa de control
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800 border border-yellow-200">
                  Pendiente
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Última actualización
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatFecha(ultimaActualizacionDisplay)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_340px] lg:items-start">
        {/* Timeline */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-800">
              Timeline / Etapas
            </p>
          </div>
          <ol className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1 text-sm">
            {ETAPAS.map((etapa) => {
              const estado = timeline[etapa.id]?.estado ?? "pendiente";
              const visual = getStageVisualStatus(
                etapa.id,
                etapaActualId,
                timeline[etapaActualId]?.estado ?? "pendiente",
              );

              const isCurrent = visual === "current" || visual === "rejected";
              const isCompleted = visual === "completed";

              const circleClasses =
                visual === "completed"
                  ? "bg-green-500 text-white"
                  : visual === "current"
                    ? "bg-blue-600 text-white"
                    : visual === "rejected"
                      ? "bg-red-600 text-white"
                      : "bg-gray-200 text-gray-800";

              const cardClasses =
                visual === "current" || visual === "rejected"
                  ? "border-blue-500 bg-blue-50"
                  : isCompleted
                    ? "border-green-400 bg-green-50"
                    : canInteractTimeline
                      ? "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50"
                      : "border-gray-200 bg-gray-50";

              let estadoLabel: string;
              if (visual === "completed") {
                estadoLabel = "Completada";
              } else if (visual === "current") {
                estadoLabel = "En proceso";
              } else if (visual === "rejected") {
                estadoLabel = "Rechazada";
              } else {
                estadoLabel = "Pendiente";
              }

              const badgeClass =
                visual === "completed"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : visual === "current"
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : visual === "rejected"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : "bg-gray-50 text-gray-700 border border-gray-200";

              return (
                <li
                  key={etapa.id}
                  className={`flex items-center justify-between rounded-lg border px-2 py-1.5 transition-colors ${canInteractTimeline ? "cursor-pointer" : "cursor-default"} ${cardClasses}`}
                  onClick={canInteractTimeline ? () => setEtapaActualId(etapa.id) : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${circleClasses}`}
                    >
                      {etapa.id}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-gray-900">
                        {etapa.nombre}
                      </p>
                      {etapa.sla && (
                        <p className="truncate text-[11px] text-gray-500">
                          {etapa.sla}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                  >
                    {estadoLabel}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Panel derecho contextual */}
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4">
          {currentRole === "asesor" ? (
            submittedToMesa ? (
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-sm font-semibold text-gray-900">
                  Enviado a mesa de control
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  El seguimiento ya lo actualiza mesa-control.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-800">Etapa</p>
                    <p className="mt-0.5">
                      {etapaActual.id}. {etapaActual.nombre}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Actualización</p>
                    <p className="mt-0.5">{formatFecha(ultimaActualizacionDisplay)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Paquete de integración + checklist compacto */}
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Paquete de integración
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Paquete mock para habilitar el envío.
                  </p>

                  <div className="mt-3 flex flex-col gap-2">
                    <ChecklistItem
                      label="INE"
                      checked={docs.ine.checked}
                      onCheckedChange={(checked) =>
                        setDocs((prev) => ({
                          ...prev,
                          ine: { ...prev.ine, checked },
                        }))
                      }
                      notes={docs.ine.notes}
                      onNotesChange={(notes) =>
                        setDocs((prev) => ({
                          ...prev,
                          ine: { ...prev.ine, notes },
                        }))
                      }
                    />
                    <ChecklistItem
                      label="Estado de cuenta"
                      checked={docs.estado_cuenta.checked}
                      onCheckedChange={(checked) =>
                        setDocs((prev) => ({
                          ...prev,
                          estado_cuenta: { ...prev.estado_cuenta, checked },
                        }))
                      }
                      notes={docs.estado_cuenta.notes}
                      onNotesChange={(notes) =>
                        setDocs((prev) => ({
                          ...prev,
                          estado_cuenta: { ...prev.estado_cuenta, notes },
                        }))
                      }
                    />
                    <ChecklistItem
                      label="NSS"
                      checked={docs.nss.checked}
                      onCheckedChange={(checked) =>
                        setDocs((prev) => ({
                          ...prev,
                          nss: { ...prev.nss, checked },
                        }))
                      }
                      notes={docs.nss.notes}
                      onNotesChange={(notes) =>
                        setDocs((prev) => ({
                          ...prev,
                          nss: { ...prev.nss, notes },
                        }))
                      }
                    />
                    <ChecklistItem
                      label="Dirección"
                      checked={docs.direccion.checked}
                      onCheckedChange={(checked) =>
                        setDocs((prev) => ({
                          ...prev,
                          direccion: { ...prev.direccion, checked },
                        }))
                      }
                      notes={docs.direccion.notes}
                      onNotesChange={(notes) =>
                        setDocs((prev) => ({
                          ...prev,
                          direccion: { ...prev.direccion, notes },
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Envío a mesa */}
                {aprobadoConMonto ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-900">
                      En mesa-control se captura la cita en etapas específicas.
                    </p>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="w-full"
                        disabled={submittedToMesa}
                        onClick={async () => {
                          const allChecked = Object.values(docs).every(
                            (doc) => doc.checked,
                          );
                          if (!allChecked) {
                            setDocsWarning(
                              "Faltan documentos del paquete de integración."
                            );
                            return;
                          }

                          setDocsWarning(null);

                          // UI: seguimos mostrando el flujo como antes (optimistic UI).
                          setSubmittedToMesa(true);
                          setTimeline((prev) => ({
                            ...prev,
                            1: {
                              ...(prev[1] ?? {
                                notasInternas: "",
                                motivo: undefined,
                                fechaCita: undefined,
                                fechaLiberacion: undefined,
                                abogadoAsignado: undefined,
                              }),
                              estado: "en_proceso",
                              ultimaActualizacion: new Date().toISOString(),
                            },
                          }));

                          // Persistencia real: repo vía callback.
                          const idPrecal = contextPrecalId;
                          if (!idPrecal) {
                            console.warn(
                              "[seguimiento] onEnviarAMesa no disponible: falta contextPrecalId"
                            );
                          } else {
                            try {
                              await onEnviarAMesa?.({
                                id: idPrecal,
                                cliente_nombre: contextClienteNombre ?? "",
                                telefono_cliente: contextTelefono ?? "",
                                programa: contextPrograma ?? "",
                                asesorNombre: contextAsesorId ?? "",
                                etapaActual: 1,
                                subestado: "en_proceso",
                                docs,
                              });
                            } catch (err) {
                              console.error(
                                "[seguimiento] error persistiendo enviar a mesa:",
                                err
                              );
                            }
                          }

                          setEtapaActualId(1);
                        }}
                      >
                        {submittedToMesa
                          ? "Enviado a mesa de control"
                          : "Enviar a mesa de control"}
                      </Button>
                      {docsWarning && (
                        <p className="mt-2 text-xs text-red-700">{docsWarning}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Esperando aprobación del editor/revisor con monto para habilitar el envío a mesa de control.
                  </div>
                )}
              </>
            )
          ) : currentRole === "mesa_control" ? (
            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">
                Mesa de control
              </p>
              {!submittedToMesa ? (
                <p className="mt-2 text-xs text-yellow-800">
                  Aún no enviado por asesor. No puedes operar hasta que el asesor envíe el paquete.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Acciones rápidas
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <Button
                        variant="outline"
                        onClick={handleMarcarEnProceso}
                        className="text-xs"
                      >
                        Marcar En proceso
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleAprobarYSiguiente}
                        className="text-xs"
                      >
                        Aprobar y pasar a siguiente
                      </Button>
                      <Button
                        variant="outline"
                        className="text-xs text-red-700 hover:text-red-800"
                        onClick={abrirModalRechazo}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>

                  {operativoWarning && (
                    <p className="text-xs text-red-700">{operativoWarning}</p>
                  )}

                  {isEtapaConFechaCita && (
                    <Input
                      type="date"
                      label="Fecha de cita"
                      value={estadoActual.fechaCita ?? fechaCita}
                      onChange={(e) => handleFechaCitaChange(e.target.value)}
                    />
                  )}

                  {isEtapaConFechaLiberacion && (
                    <Input
                      type="date"
                      label="Fecha de liberación / registrado en"
                      value={estadoActual.fechaLiberacion ?? fechaLiberacion}
                      onChange={(e) => handleFechaLiberacionChange(e.target.value)}
                    />
                  )}

                  {isEtapaConAbogado && (
                    <Select
                      label="Abogado asignado"
                      value={estadoActual.abogadoAsignado ?? abogadoAsignado}
                      onChange={(e) =>
                        handleAbogadoChange(e.target.value as Abogado | "")
                      }
                      options={[
                        { value: "", label: "Selecciona abogado" },
                        { value: "elis", label: "Elis" },
                        { value: "roberto", label: "Roberto" },
                      ]}
                    />
                  )}

                  <div>
                    <label
                      htmlFor="notas_internas"
                      className="text-sm font-medium text-gray-700"
                    >
                      Notas internas
                    </label>
                    <textarea
                      id="notas_internas"
                      value={estadoActual.notasInternas}
                      onChange={(e) => handleGuardarNotas(e.target.value)}
                      placeholder="Notas internas de seguimiento..."
                      className="mt-1 h-24 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Agenda eliminado: la cita se captura en mesa-control (etapa 3 y 9). */}
      </div>

      {showRechazoModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-gray-900">
              Registrar rechazo de etapa
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Esta acción es solo mock y no afecta datos reales.
            </p>

            <div className="mt-4 space-y-3">
              <Select
                label="Motivo de rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                options={[
                  { value: "", label: "Selecciona un motivo" },
                  ...motivosDisponibles,
                ]}
              />
              <div>
                <label
                  htmlFor="nota_rechazo"
                  className="text-sm font-medium text-gray-700"
                >
                  Nota interna (opcional)
                </label>
                <textarea
                  id="nota_rechazo"
                  value={notaRechazo}
                  onChange={(e) => setNotaRechazo(e.target.value)}
                  placeholder="Detalle adicional del rechazo..."
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {etapaActual.id === 2 &&
                motivoRechazo === "registrado_otro_proveedor" && (
                  <Input
                    type="date"
                    label="Fecha de liberación / registrado en"
                    value={fechaLiberacion}
                    onChange={(e) => setFechaLiberacion(e.target.value)}
                  />
                )}

              {etapaActual.id === 12 &&
                motivoRechazo === "cliente_no_quiere_pagar" && (
                  <Select
                    label="Abogado asignado"
                    value={abogadoAsignado}
                    onChange={(e) =>
                      setAbogadoAsignado(e.target.value as Abogado | "")
                    }
                    options={[
                      { value: "", label: "Selecciona abogado" },
                      { value: "elis", label: "Elis" },
                      { value: "roberto", label: "Roberto" },
                    ]}
                  />
                )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={cerrarModalRechazo}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmarRechazo}
                disabled={!motivoRechazo}
              >
                Confirmar rechazo
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

