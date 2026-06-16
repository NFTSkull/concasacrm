-- ConCasa CRM — P2C-2 RPC update_documento_revision (Mesa valida/rechaza documentos)

-- =============================================================================
-- update_documento_revision
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_documento_revision(
  p_documento_id UUID,
  p_estatus public.estatus_revision,
  p_comentario_mesa TEXT DEFAULT NULL
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
  v_doc RECORD;
  v_estatus_anterior public.estatus_revision;
  v_comentario_final TEXT;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'update_documento_revision: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_documento_revision: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('mesa_admin', 'mesa_interno', 'mesa_externo', 'super_admin') THEN
    RAISE EXCEPTION 'update_documento_revision: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_documento_id IS NULL THEN
    RAISE EXCEPTION 'update_documento_revision: documento_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_estatus IS NULL THEN
    RAISE EXCEPTION 'update_documento_revision: estatus_revision es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_estatus = 'rechazado' THEN
    IF p_comentario_mesa IS NULL OR btrim(p_comentario_mesa) = '' THEN
      RAISE EXCEPTION 'update_documento_revision: comentario_mesa es obligatorio al rechazar'
        USING ERRCODE = '22023';
    END IF;
    v_comentario_final := btrim(p_comentario_mesa);
  ELSE
    v_comentario_final := NULLIF(btrim(COALESCE(p_comentario_mesa, '')), '');
  END IF;

  SELECT
    d.id,
    d.organization_id,
    d.expediente_id,
    d.tipo_documento,
    d.estatus_revision,
    d.deleted_at AS doc_deleted_at,
    e.deleted_at AS exp_deleted_at
  INTO v_doc
  FROM public.expediente_documentos d
  INNER JOIN public.expedientes e ON e.id = d.expediente_id
  WHERE d.id = p_documento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_documento_revision: documento no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_doc.doc_deleted_at IS NOT NULL OR v_doc.exp_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'update_documento_revision: documento o expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role <> 'super_admin'
     AND v_doc.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'update_documento_revision: documento fuera de la organización del actor'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_see_expediente(v_doc.expediente_id) THEN
    RAISE EXCEPTION 'update_documento_revision: no autorizado para operar este expediente'
      USING ERRCODE = '42501';
  END IF;

  v_estatus_anterior := v_doc.estatus_revision;

  UPDATE public.expediente_documentos
  SET
    estatus_revision = p_estatus,
    comentario_mesa = v_comentario_final,
    updated_at = NOW()
  WHERE id = p_documento_id;

  PERFORM public.log_action(
    v_doc.organization_id,
    v_actor_id,
    v_actor_role,
    'documento.revision.update',
    'expediente_documento',
    p_documento_id,
    jsonb_build_object(
      'expediente_id', v_doc.expediente_id,
      'tipo_documento', v_doc.tipo_documento,
      'estatus_anterior', v_estatus_anterior,
      'estatus_nuevo', p_estatus,
      'comentario_mesa', v_comentario_final
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', p_documento_id,
    'expediente_id', v_doc.expediente_id,
    'estatus_revision', p_estatus,
    'comentario_mesa', v_comentario_final
  );
END;
$$;

COMMENT ON FUNCTION public.update_documento_revision(UUID, public.estatus_revision, TEXT) IS
  'Mesa valida/rechaza documento. SECURITY DEFINER con validación interna; dispara historial y action_log.';

REVOKE ALL ON FUNCTION public.update_documento_revision(UUID, public.estatus_revision, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_documento_revision(UUID, public.estatus_revision, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.update_documento_revision(UUID, public.estatus_revision, TEXT) TO authenticated;
