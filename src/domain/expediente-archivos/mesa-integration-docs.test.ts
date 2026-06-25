import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMesaIntegrationDocViews,
  resolveMesaArchivoPorTipo,
} from "./mesa-integration-docs";
import type { ExpedienteArchivoListItem } from "./map-supabase-expediente-documentos";
import type { ExpedienteArchivoResumen } from "./types";

const EXP_ID = "exp-1";

function catalogRow(
  tipo: ExpedienteArchivoResumen["tipo_documento"],
  partial: Partial<ExpedienteArchivoResumen> = {},
): ExpedienteArchivoResumen {
  return {
    expediente_id: EXP_ID,
    tipo_documento: tipo,
    id: null,
    nombre_original: null,
    mime_type: null,
    size_bytes: null,
    created_at: null,
    uploaded_by_role: null,
    uploaded_by_email: null,
    estatus_revision: "faltante",
    comentario_mesa: null,
    ...partial,
  };
}

function listaItem(
  tipo: ExpedienteArchivoListItem["tipo_documento"],
  partial: Partial<ExpedienteArchivoListItem> = {},
): ExpedienteArchivoListItem {
  return {
    expediente_id: EXP_ID,
    tipo_documento: tipo,
    id: "doc-nss-1",
    nombre_original: "nss.pdf",
    mime_type: "application/pdf",
    size_bytes: 100,
    created_at: "2026-06-01T00:00:00.000Z",
    uploaded_by_role: "asesor",
    uploaded_by_email: "asesor@concasa.mx",
    estatus_revision: "subido",
    comentario_mesa: null,
    ...partial,
  };
}

test("resolveMesaArchivoPorTipo: prioriza lista activa con id real", () => {
  const catalog = [catalogRow("nss", { estatus_revision: "faltante", id: null })];
  const lista = [listaItem("nss")];
  const resolved = resolveMesaArchivoPorTipo("nss", catalog, lista);
  assert.equal(resolved?.id, "doc-nss-1");
  assert.equal(resolved?.nombre_original, "nss.pdf");
});

test("buildMesaIntegrationDocViews: solo 5 documentos del asesor (sin complementarios Mesa)", () => {
  const catalog = [
    catalogRow("nss"),
    catalogRow("cliente_semanas_cotizadas", { estatus_revision: "subido", id: "doc-sem" }),
    catalogRow("cliente_acta_nacimiento"),
  ];
  const views = buildMesaIntegrationDocViews(catalog, []);
  const tipos = views.map((v) => v.tipo_documento as string);
  assert.equal(views.length, 5);
  assert.ok(!tipos.includes("cliente_semanas_cotizadas"));
  assert.ok(!tipos.includes("cliente_acta_nacimiento"));
  assert.ok(!tipos.includes("cliente_constancia_sat"));
});

test("buildMesaIntegrationDocViews: subido con id permite abrir; faltante no", () => {
  const catalog = [
    catalogRow("nss", {
      id: "doc-nss-cat",
      estatus_revision: "subido",
      nombre_original: "nss-cat.pdf",
      mime_type: "application/pdf",
    }),
    catalogRow("cliente_ine_frente"),
  ];
  const views = buildMesaIntegrationDocViews(catalog, []);
  const nss = views.find((v) => v.tipo_documento === "nss");
  const ine = views.find((v) => v.tipo_documento === "cliente_ine_frente");
  assert.ok(nss);
  assert.ok(ine);
  assert.equal(nss.estatus_revision, "subido");
  assert.equal(nss.archivo?.id, "doc-nss-cat");
  assert.equal(ine.estatus_revision, "faltante");
  assert.equal(ine.archivo, null);
});
