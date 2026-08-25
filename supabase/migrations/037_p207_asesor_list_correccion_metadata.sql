-- P207 — Metadata causal de corrección en asesor_list_expedientes_page
--
-- BLOQUEADOR DE APLICACIÓN EN ESTE REPO:
--   GitHub NFTSkull/concasacrm solo tiene migraciones hasta 036.
--   Producción (Vercel dpl_6tNpAKtBuSTWqH85UYpUcw7ZKMyG) exige migración 161+
--   con RPC asesor_list_expedientes_page / asesor_inbox_estado_efectivo / P198.
--
-- Esta migración es un CONTRATO / patch a aplicar SOBRE el SQL de producción
-- (renumerar al siguiente id Cloud, p.ej. 162+), NO sobre el schema local 036.
--
-- Objetivo (C4–C5, C7):
--   Extender el read-model paginado con metadata READ-ONLY del episodio P198
--   vigente que provoca estado_efectivo = correccion_requerida, sin N+1
--   desde el frontend y sin cargar todos los documentos antes del first paint.
--
-- Campos sugeridos por ítem (JSONB / columnas):
--   correccion_request_type   text  -- SOLICITUD_DATOS_GENERALES | SOLICITUD_DOCUMENTAL | ...
--   correccion_request_at     timestamptz
--   correccion_document_kind  text  -- tipo_documento causal si SOLICITUD_DOCUMENTAL
--
-- Autoridad: mesa_cambio_revision_estado_efectivo / episodio WAITING_ADVISOR actual.
-- Si estado = WAITING_ADVISOR y request_type = RECHAZO_OPERATIVO_CON_CORRECCION
--   → estado_efectivo debe ser rechazado_mesa (P204-A), no correccion_requerida.
--
-- Performance (C5 / C15 / P203):
--   Derivar metadata dentro del mismo RPC de listado (JOIN/lateral al episodio
--   vigente), NO por fila desde el cliente. Medir EXPLAIN antes/después si el
--   plan cambia materialmente.
--
-- NO hacer en este bloque:
--   validar DG/docs, crear P130, cerrar WAITING, mutar P198 ni requests.

-- Placeholder intencional: el cuerpo CREATE OR REPLACE de
-- asesor_list_expedientes_page vive solo en Cloud (post-161) y no está versionado
-- en este repositorio. Al sincronizar el SQL de producción, reemplazar este
-- comentario por el CREATE OR REPLACE completo que añada las tres columnas
-- al SELECT del listado y al payload JSONB de items.

DO $$
BEGIN
  RAISE NOTICE 'P207: migración contrato — requiere SQL Cloud post-161 (asesor_list_expedientes_page). No-op en schema local ≤036.';
END $$;
