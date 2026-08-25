import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASESOR_CORRECCION_FALLBACK_COPY,
  countAsesorCorreccionesAbiertas,
  formatAsesorCorreccionInboxCopy,
  listAsesorCorreccionesAbiertas,
  listCorreccionItemsFromP198,
  resolveAsesorCorreccionDetalleFocus,
  uiActualPuedeExplicarCorreccion,
} from "./correccion-motivo";

describe("P207 correccion-motivo", () => {
  it("C1 WAITING DG → Mesa solicita corregir: Datos generales.", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: { clienteDatosEstado: "validado", archivos: [] },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DATOS_GENERALES",
        requestAt: "2026-08-20T12:00:00Z",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: Datos generales.");
  });

  it("C2 WAITING documental INE → muestra INE correspondiente", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: { archivos: [] },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DOCUMENTAL",
        documentKind: "cliente_ine_frente",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: INE frente.");
  });

  it("C3 WAITING documental estado de cuenta", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: { archivos: [] },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DOCUMENTAL",
        documentKind: "cliente_estado_cuenta",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: Estado de cuenta.");
  });

  it("C4 2 elementos abiertos → copy plural correcto", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: {
        clienteDatosEstado: "rechazado",
        archivos: [
          {
            tipo_documento: "cliente_ine_frente",
            estatus_revision: "rechazado",
          },
        ],
      },
    });
    assert.equal(
      copy,
      "Mesa solicita corregir 2 elementos: Datos generales e INE frente.",
    );
  });

  it("C5 correccion_requerida + enrich aún no cargado → motivo P198 first paint", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: null,
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DATOS_GENERALES",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: Datos generales.");
  });

  it("C6 correccion_requerida + enrich failure (count 0) → sigue P198", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: { clienteDatosEstado: "validado", archivos: [] },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DOCUMENTAL",
        documentKind: "cliente_estado_cuenta",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: Estado de cuenta.");
    assert.equal(
      countAsesorCorreccionesAbiertas({
        clienteDatosEstado: "validado",
        archivos: [],
      }),
      0,
    );
  });

  it("C7 request histórico A + vigente B → solo B", () => {
    const items = listCorreccionItemsFromP198({
      mesaCambioEstado: "WAITING_ADVISOR",
      requestType: "SOLICITUD_DATOS_GENERALES",
      documentKind: "cliente_ine_frente", // histórico residual no aplica a DG
    });
    assert.deepEqual(
      items.map((i) => i.key),
      ["datos_generales"],
    );
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: {
        // histórico: doc A ya no rechazado
        archivos: [
          {
            tipo_documento: "cliente_ine_frente",
            estatus_revision: "validado",
          },
        ],
      },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DATOS_GENERALES",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: Datos generales.");
  });

  it("C8 respuesta posterior → deja de correccion_requerida", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_enviada",
      p198: {
        mesaCambioEstado: "CORRECTION_PENDING_REVIEW",
        requestType: "SOLICITUD_DATOS_GENERALES",
      },
    });
    assert.equal(copy, null);
  });

  it("C9 CORRECTION_PENDING_REVIEW → no muestra pendiente de corregir", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_enviada",
      enrich: { clienteDatosEstado: "rechazado", archivos: [] },
      p198: {
        mesaCambioEstado: "CORRECTION_PENDING_REVIEW",
        requestType: "SOLICITUD_DATOS_GENERALES",
      },
    });
    assert.equal(copy, null);
  });

  it("C10 CLOSED → no muestra copy viejo", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "en_tramite",
      enrich: { clienteDatosEstado: "rechazado", archivos: [] },
      p198: {
        mesaCambioEstado: "CLOSED",
        requestType: "SOLICITUD_DOCUMENTAL",
        documentKind: "cliente_ine_frente",
      },
    });
    assert.equal(copy, null);
  });

  it("C11 RECHAZO_OPERATIVO WAITING → no como correccion_requerida items", () => {
    const items = listCorreccionItemsFromP198({
      mesaCambioEstado: "WAITING_ADVISOR",
      requestType: "RECHAZO_OPERATIVO_CON_CORRECCION",
    });
    assert.equal(items.length, 0);
    // Si mal clasificado como correccion_requerida, fallback (no inventar DG/doc)
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: { archivos: [] },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "RECHAZO_OPERATIVO_CON_CORRECCION",
      },
    });
    assert.equal(copy, ASESOR_CORRECCION_FALLBACK_COPY);
  });

  it("C12 fallback histórico sin metadata → texto seguro no vacío", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: { archivos: [] },
      p198: null,
    });
    assert.equal(copy, ASESOR_CORRECCION_FALLBACK_COPY);
    assert.ok(copy && copy.length > 0);
  });

  it("C13 inbox y detalle coinciden (mismo focus)", () => {
    const input = {
      estadoEfectivo: "correccion_requerida" as const,
      enrich: { archivos: [] as [] },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR" as const,
        requestType: "SOLICITUD_DOCUMENTAL" as const,
        documentKind: "cliente_estado_cuenta",
      },
    };
    const copy = formatAsesorCorreccionInboxCopy(input);
    const focus = resolveAsesorCorreccionDetalleFocus(input);
    assert.equal(copy, "Mesa solicita corregir: Estado de cuenta.");
    assert.deepEqual(focus, {
      kind: "documento",
      tipo_documento: "cliente_estado_cuenta",
    });
  });

  it("C14 sin N+1: metadata P198 basta (enrich opcional)", () => {
    // First paint: solo RPC fields, sin archivos/cliente_datos
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DOCUMENTAL",
        documentKind: "cliente_ine_reverso",
      },
    });
    assert.equal(copy, "Mesa solicita corregir: INE reverso.");
  });

  it("C15 enrich tiene prioridad sobre P198 cuando hay elementos actuales", () => {
    const copy = formatAsesorCorreccionInboxCopy({
      estadoEfectivo: "correccion_requerida",
      enrich: {
        clienteDatosEstado: "rechazado",
        archivos: [],
      },
      p198: {
        mesaCambioEstado: "WAITING_ADVISOR",
        requestType: "SOLICITUD_DOCUMENTAL",
        documentKind: "cliente_ine_frente",
      },
    });
    // Prioridad 1: enrich actual (DG), no el doc P198 si enrich ya explica
    assert.equal(copy, "Mesa solicita corregir: Datos generales.");
  });

  it("uiActualPuedeExplicar: count=0 → NO (bug Mauricio)", () => {
    assert.equal(
      uiActualPuedeExplicarCorreccion({
        estadoEfectivo: "correccion_requerida",
        enrichCount: 0,
      }),
      "NO",
    );
    assert.equal(
      uiActualPuedeExplicarCorreccion({
        estadoEfectivo: "correccion_requerida",
        enrichCount: 1,
      }),
      "YES",
    );
  });

  it("listAsesorCorreccionesAbiertas: retención correccion_requerida", () => {
    const items = listAsesorCorreccionesAbiertas({
      retencionEnvioEstado: "correccion_requerida",
      archivos: [],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, "acuse");
  });
});
