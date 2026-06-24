"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AsesorSeguimientoOperativo } from "@/components/asesor/AsesorSeguimientoOperativo";
import { Button } from "@/components/ui/Button";
import {
  useExpedienteClienteDatosRepo,
  type ExpedienteClienteDatos,
} from "@/domain/expediente-cliente-datos";
import {
  deriveIntegrationDocsChecklist,
  deriveIntegrationDocsChecklistOpcionales,
  integrationDocsResumenFromArchivoResumen,
  type ExpedienteArchivoResumen,
  type IntegrationDocChecklistItem,
  useExpedienteArchivosRepo,
} from "@/domain/expediente-archivos";
import {
  ExpedientesSupabaseError,
  useExpedientesRepo,
  type ExpedienteMock,
} from "@/domain/expedientes";
import { useSessionRepo } from "@/domain/session";
import { subestadoOperativoLabel } from "@/lib/subestadoOperativoUi";

type LoadState = "loading" | "ready" | "not_found" | "error";

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function editorDecisionLabel(decision?: string | null): string {
  if (decision === "aprobado") return "Aprobado";
  if (decision === "no_cumple") return "No cumple";
  return "Pendiente";
}

function origenMesaLabel(origen: string | null | undefined): string {
  if (origen === "interno") return "Interno";
  if (origen === "externo") return "Externo";
  return "—";
}

function estatusRevisionLabel(estatus: IntegrationDocChecklistItem["estatus_revision"]): string {
  if (estatus === "faltante") return "Faltante";
  if (estatus === "subido") return "Subido";
  if (estatus === "resubido") return "Resubido";
  if (estatus === "validado") return "Validado";
  if (estatus === "rechazado") return "Rechazado";
  return estatus;
}

function estatusRevisionBadgeClass(
  estatus: IntegrationDocChecklistItem["estatus_revision"],
): string {
  if (estatus === "validado") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (estatus === "rechazado") return "bg-red-50 text-red-900 ring-red-200";
  if (estatus === "resubido") return "bg-orange-50 text-orange-950 ring-orange-200";
  if (estatus === "subido") return "bg-sky-50 text-sky-900 ring-sky-200";
  return "bg-amber-50 text-amber-950 ring-amber-200";
}

function MesaDetalleShell({
  children,
  title = "ConCasa CRM · Expediente Mesa",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/mesa-control" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a Mesa de control
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <span className="w-24" aria-hidden />
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}

function DocumentoAsesorRow({ item }: { item: IntegrationDocChecklistItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{item.label}</p>
        {item.opcional ? (
          <p className="text-[11px] text-gray-500">Opcional</p>
        ) : null}
      </div>
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${estatusRevisionBadgeClass(item.estatus_revision)}`}
      >
        {estatusRevisionLabel(item.estatus_revision)}
      </span>
    </li>
  );
}

export function MesaExpedienteDetalleReadOnly() {
  const { id } = useParams<{ id: string }>();
  const routeExpedienteId =
    id === undefined || id === null || id === "" ? "" : String(id);
  const { currentUser } = useSessionRepo();
  const expedientesRepo = useExpedientesRepo();
  const archivosRepo = useExpedienteArchivosRepo();
  const clienteDatosRepo = useExpedienteClienteDatosRepo();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteMock | null>(null);
  const [clienteDatos, setClienteDatos] = useState<ExpedienteClienteDatos | null>(null);
  const [archivosResumen, setArchivosResumen] = useState<ExpedienteArchivoResumen[]>([]);

  const load = useCallback(() => {
    if (!routeExpedienteId || !currentUser) return;
    void (async () => {
      setLoadState("loading");
      setErrorMsg(null);
      try {
        const exp = await expedientesRepo.getById(routeExpedienteId);
        if (!exp) {
          setExpediente(null);
          setClienteDatos(null);
          setArchivosResumen([]);
          setLoadState("not_found");
          return;
        }

        const [datos, archivos] = await Promise.all([
          clienteDatosRepo.getByExpedienteId(routeExpedienteId).catch(() => null),
          archivosRepo.listResumenByExpediente(routeExpedienteId).catch(() => []),
        ]);

        setExpediente(exp);
        setClienteDatos(datos);
        setArchivosResumen(archivos);
        setLoadState("ready");
      } catch (err) {
        setExpediente(null);
        setClienteDatos(null);
        setArchivosResumen([]);
        setLoadState("error");
        if (err instanceof ExpedientesSupabaseError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("No se pudo cargar el expediente.");
        }
      }
    })();
  }, [
    archivosRepo,
    clienteDatosRepo,
    currentUser,
    expedientesRepo,
    routeExpedienteId,
  ]);

  useEffect(() => {
    if (!currentUser) return;
    load();
  }, [currentUser, load]);

  const documentosAsesor = useMemo(() => {
    const input = integrationDocsResumenFromArchivoResumen(archivosResumen);
    return [
      ...deriveIntegrationDocsChecklist(input),
      ...deriveIntegrationDocsChecklistOpcionales(input),
    ];
  }, [archivosResumen]);

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          <Link href="/login" className="text-blue-600 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <MesaDetalleShell>
        <p className="text-gray-500">Cargando expediente...</p>
      </MesaDetalleShell>
    );
  }

  if (loadState === "not_found") {
    return (
      <MesaDetalleShell>
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
        >
          No tienes acceso a este expediente o no existe.
        </p>
        <Link href="/mesa-control" className="mt-4 inline-block">
          <Button variant="secondary">Volver a Mesa de control</Button>
        </Link>
      </MesaDetalleShell>
    );
  }

  if (loadState === "error") {
    return (
      <MesaDetalleShell>
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMsg ?? "Error al cargar el expediente."}
        </p>
        <Link href="/mesa-control" className="mt-4 inline-block">
          <Button variant="secondary">Volver a Mesa de control</Button>
        </Link>
      </MesaDetalleShell>
    );
  }

  if (!expediente) {
    return null;
  }

  const op = expediente.operativo;
  const ed = expediente.editorDecision;

  return (
    <MesaDetalleShell>
      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-900">Resumen del expediente</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p>
            <span className="font-medium text-gray-900">Cliente:</span>{" "}
            {expediente.base.cliente_nombre || "—"}
          </p>
          <p>
            <span className="font-medium text-gray-900">Programa:</span>{" "}
            {expediente.base.programa}
          </p>
          <p>
            <span className="font-medium text-gray-900">NSS:</span> {expediente.base.nss || "—"}
          </p>
          <p>
            <span className="font-medium text-gray-900">Teléfono:</span>{" "}
            {expediente.base.telefono_cliente || "—"}
          </p>
          <p>
            <span className="font-medium text-gray-900">Asesor:</span>{" "}
            {expediente.base.asesorId || "—"}
          </p>
          <p>
            <span className="font-medium text-gray-900">Origen Mesa:</span>{" "}
            {origenMesaLabel(expediente.base.origenMesa)}
          </p>
          <p>
            <span className="font-medium text-gray-900">Etapa actual:</span>{" "}
            {op.etapaActual ?? "—"}
          </p>
          <p>
            <span className="font-medium text-gray-900">Subestado:</span>{" "}
            {subestadoOperativoLabel(op.subestado ?? "pendiente")}
          </p>
          <p>
            <span className="font-medium text-gray-900">Enviado a Mesa:</span>{" "}
            {op.submittedToMesa ? "Sí" : "No"}
          </p>
          <p>
            <span className="font-medium text-gray-900">Fecha envío Mesa:</span>{" "}
            {op.fechaEnvioMesa ? formatDateTime(op.fechaEnvioMesa) : "—"}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium text-gray-900">Última actualización:</span>{" "}
            {op.updatedAt ? formatDateTime(op.updatedAt) : "—"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-900">Decisión del editor</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p>
            <span className="font-medium text-gray-900">Decisión:</span>{" "}
            {editorDecisionLabel(ed.decision)}
          </p>
          <p>
            <span className="font-medium text-gray-900">Monto aprobado:</span>{" "}
            {ed.decision === "aprobado" && typeof ed.monto_aprobado === "number"
              ? `$${ed.monto_aprobado.toLocaleString("es-MX")}`
              : "—"}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium text-gray-900">Notas revisión:</span>{" "}
            {ed.notas_revision?.trim() || "—"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-900">Datos generales del cliente</h2>
        {clienteDatos ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p>
              <span className="font-medium text-gray-900">Nombre:</span>{" "}
              {clienteDatos.datos.nombreCliente || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-900">RFC:</span>{" "}
              {clienteDatos.datos.rfc || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-900">Celular:</span>{" "}
              {clienteDatos.datos.celular || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-900">Correo:</span>{" "}
              {clienteDatos.datos.correo || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-900">Empresa:</span>{" "}
              {clienteDatos.datos.empresa || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-900">Estado captura:</span>{" "}
              {clienteDatos.estado}
            </p>
            <p className="sm:col-span-2 text-xs text-gray-500">
              Actualizado: {formatDateTime(clienteDatos.updatedAt)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Sin datos generales registrados todavía.</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold text-gray-900">Documentos del asesor</h2>
        <p className="mt-1 text-xs text-gray-500">
          Solo lectura · sin validar ni descargar en este bloque (P3J.3 / P3J.2b).
        </p>
        {documentosAsesor.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {documentosAsesor.map((item) => (
              <DocumentoAsesorRow key={item.tipo_documento} item={item} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No hay documentos registrados.</p>
        )}
      </section>

      <AsesorSeguimientoOperativo
        etapaActual={op.etapaActual}
        subestado={op.subestado}
        submittedToMesa={op.submittedToMesa}
        fechaEnvioMesa={op.fechaEnvioMesa}
        updatedAt={op.updatedAt}
        cicloEstado={op.cicloEstado}
        origenMesa={expediente.base.origenMesa}
        formatDateTime={formatDateTime}
      />
    </MesaDetalleShell>
  );
}
