-- ConCasa CRM — P3K.2: documentos complementarios Mesa opcionales (no bloquean avance 1→2)
-- Semanas / Acta / Constancia SAT: upload Mesa permitido; NO en integration_doc_tipos_obligatorios.

CREATE OR REPLACE FUNCTION public.integration_doc_tipos_obligatorios()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.integration_doc_tipos_asesor_envio();
$$;

COMMENT ON FUNCTION public.integration_doc_tipos_obligatorios() IS
  'P3K.2: validación Mesa y avance 1→2 — solo 5 documentos del asesor validados. Complementarios Mesa (semanas/acta/SAT) son opcionales.';

COMMENT ON FUNCTION public.count_integration_docs_validados(UUID) IS
  'Cuenta documentos validados de integration_doc_tipos_obligatorios (lista de 5).';

COMMENT ON FUNCTION public.integration_docs_todos_validados(UUID) IS
  'true si los 5 documentos de integration_doc_tipos_obligatorios están validados.';
