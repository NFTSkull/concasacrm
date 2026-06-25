-- ConCasa CRM — P3O.1: upload/register documentos retención etapa 8 (asesor)

-- =============================================================================
-- Catálogo upload asesor — retención (etapa 8)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.retencion_doc_tipos_asesor_upload()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'retencion_acuse_con_sello',
    'retencion_aviso_retencion',
    'retencion_ine_frente',
    'retencion_ine_reverso',
    'retencion_carta_sin_sello'
  ]::TEXT[];
$$;

COMMENT ON FUNCTION public.retencion_doc_tipos_asesor_upload() IS
  'P3O.1: tipos retencion_* permitidos para upload/register asesor en etapa 8.';

REVOKE ALL ON FUNCTION public.retencion_doc_tipos_asesor_upload() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retencion_doc_tipos_asesor_upload() TO authenticated;

-- =============================================================================
-- Storage policy helper — upload retención etapa 8
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expediente_documento_storage_asesor_retencion_upload_allowed(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parsed RECORD;
  v_actor_id UUID;
  v_actor_role public.app_role;
  v_actor_org UUID;
  v_exp RECORD;
BEGIN
  SELECT *
  INTO v_parsed
  FROM public.parse_expediente_documento_storage_path(p_object_name);

  IF v_parsed.organization_id IS NULL
     OR v_parsed.expediente_id IS NULL
     OR v_parsed.tipo_documento IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (v_parsed.tipo_documento = ANY(public.retencion_doc_tipos_asesor_upload())) THEN
    RETURN false;
  END IF;

  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_actor_org
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND OR v_actor_role <> 'asesor' THEN
    RETURN false;
  END IF;

  IF v_actor_org IS DISTINCT FROM v_parsed.organization_id THEN
    RETURN false;
  END IF;

  SELECT
    e.id,
    e.organization_id,
    e.asesor_id,
    e.ciclo_estado,
    e.submitted_to_mesa,
    e.etapa_actual,
    e.subestado,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = v_parsed.expediente_id
    AND e.organization_id = v_parsed.organization_id;

  IF NOT FOUND OR v_exp.deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF v_exp.asesor_id IS DISTINCT FROM v_actor_id THEN
    RETURN false;
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RETURN false;
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF v_exp.etapa_actual <> 8 THEN
    RETURN false;
  END IF;

  IF v_exp.subestado <> 'en_proceso' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.expediente_documento_storage_asesor_retencion_upload_allowed(TEXT) IS
  'P3O.1: policy Storage INSERT/DELETE — asesor dueño, retencion_* en etapa 8 post-Mesa.';

REVOKE ALL ON FUNCTION public.expediente_documento_storage_asesor_retencion_upload_allowed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expediente_documento_storage_asesor_retencion_upload_allowed(TEXT) TO authenticated;

-- =============================================================================
-- Policies storage.objects — ampliar INSERT/DELETE para retención etapa 8
-- =============================================================================
DROP POLICY IF EXISTS expediente_documentos_storage_insert ON storage.objects;
CREATE POLICY expediente_documentos_storage_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expediente-documentos'
    AND (
      public.expediente_documento_storage_asesor_upload_allowed(name)
      OR public.expediente_documento_storage_mesa_upload_allowed(name)
      OR public.expediente_documento_storage_asesor_correccion_allowed(name)
      OR public.expediente_documento_storage_asesor_retencion_upload_allowed(name)
    )
  );

DROP POLICY IF EXISTS expediente_documentos_storage_delete ON storage.objects;
CREATE POLICY expediente_documentos_storage_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expediente-documentos'
    AND (
      public.expediente_documento_storage_asesor_upload_allowed(name)
      OR public.expediente_documento_storage_mesa_upload_allowed(name)
      OR public.expediente_documento_storage_asesor_correccion_allowed(name)
      OR public.expediente_documento_storage_asesor_retencion_upload_allowed(name)
    )
  );

-- =============================================================================
-- RPC register_expediente_documento_retencion
-- =============================================================================
CREATE OR REPLACE FUNCTION public.register_expediente_documento_retencion(
  p_expediente_id UUID,
  p_tipo_documento TEXT,
  p_storage_path TEXT,
  p_nombre_original TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role public.app_role;
  v_org_id UUID;
  v_exp RECORD;
  v_tipo TEXT;
  v_prev_id UUID;
  v_prev_estatus public.estatus_revision;
  v_new_version INTEGER;
  v_new_estatus public.estatus_revision;
  v_new_id UUID;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role <> 'asesor' THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_documento, '')), '');
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: tipo_documento es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (v_tipo = ANY(public.retencion_doc_tipos_asesor_upload())) THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: tipo_documento no permitido para retención (%)', v_tipo
      USING ERRCODE = '22023';
  END IF;

  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: storage_path es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_nombre_original IS NULL OR btrim(p_nombre_original) = '' THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: nombre_original es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.expediente_documento_mime_permitido(p_mime_type) THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: mime_type no permitido (%)', p_mime_type
      USING ERRCODE = '22023';
  END IF;

  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: size_bytes debe ser mayor a 0'
      USING ERRCODE = '22023';
  END IF;

  IF p_size_bytes > public.expediente_documento_max_size_bytes() THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: archivo excede tamaño máximo permitido'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    e.id,
    e.organization_id,
    e.asesor_id,
    e.ciclo_estado,
    e.submitted_to_mesa,
    e.etapa_actual,
    e.subestado,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: expediente fuera de la organización del asesor'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.asesor_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: solo el asesor dueño puede registrar documentos de retención'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: el expediente no está en ciclo activo'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: el expediente aún no fue enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.etapa_actual <> 8 THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: expediente debe estar en etapa 8 (actual: %)', v_exp.etapa_actual
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.subestado <> 'en_proceso' THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: subestado debe ser en_proceso (actual: %)', v_exp.subestado
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.expediente_documento_storage_path_valid(
    btrim(p_storage_path),
    v_exp.organization_id,
    p_expediente_id,
    v_tipo
  ) THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: storage_path no coincide con expediente/tipo'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'expediente-documentos'
      AND o.name = btrim(p_storage_path)
  ) THEN
    RAISE EXCEPTION 'register_expediente_documento_retencion: objeto no encontrado en storage'
      USING ERRCODE = '22023';
  END IF;

  SELECT d.id, d.estatus_revision
  INTO v_prev_id, v_prev_estatus
  FROM public.expediente_documentos d
  WHERE d.expediente_id = p_expediente_id
    AND d.tipo_documento = v_tipo
    AND d.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_prev_estatus = 'validado' THEN
      RAISE EXCEPTION 'register_expediente_documento_retencion: documento validado; Mesa debe rechazarlo antes de reemplazar'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.expediente_documentos
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = v_prev_id;
  ELSE
    v_prev_estatus := NULL;
  END IF;

  SELECT COALESCE(MAX(d.version), 0) + 1
  INTO v_new_version
  FROM public.expediente_documentos d
  WHERE d.expediente_id = p_expediente_id
    AND d.tipo_documento = v_tipo;

  IF v_prev_estatus = 'rechazado' THEN
    v_new_estatus := 'resubido';
  ELSE
    v_new_estatus := 'subido';
  END IF;

  INSERT INTO public.expediente_documentos (
    organization_id,
    expediente_id,
    tipo_documento,
    storage_path,
    nombre_original,
    mime_type,
    size_bytes,
    version,
    estatus_revision,
    comentario_mesa,
    uploaded_by,
    uploaded_by_role
  ) VALUES (
    v_exp.organization_id,
    p_expediente_id,
    v_tipo,
    btrim(p_storage_path),
    btrim(p_nombre_original),
    lower(btrim(p_mime_type)),
    p_size_bytes,
    v_new_version,
    v_new_estatus,
    NULL,
    v_actor_id,
    'asesor'
  )
  RETURNING id INTO v_new_id;

  PERFORM public.log_action(
    v_exp.organization_id,
    v_actor_id,
    v_actor_role,
    'expediente.documento.register_retencion',
    'expediente_documento',
    v_new_id,
    jsonb_build_object(
      'expediente_id', p_expediente_id,
      'tipo_documento', v_tipo,
      'version', v_new_version,
      'storage_path', btrim(p_storage_path),
      'nombre_original', btrim(p_nombre_original),
      'mime_type', lower(btrim(p_mime_type)),
      'size_bytes', p_size_bytes,
      'estatus_revision', v_new_estatus,
      'reemplazo', v_prev_id IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', v_new_id,
    'expediente_id', p_expediente_id,
    'tipo_documento', v_tipo,
    'version', v_new_version,
    'estatus_revision', v_new_estatus,
    'storage_path', btrim(p_storage_path)
  );
END;
$$;

COMMENT ON FUNCTION public.register_expediente_documento_retencion(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) IS
  'P3O.1: asesor dueño registra metadata retencion_* tras subir a Storage en etapa 8.';

REVOKE ALL ON FUNCTION public.register_expediente_documento_retencion(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_expediente_documento_retencion(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_expediente_documento_retencion(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
