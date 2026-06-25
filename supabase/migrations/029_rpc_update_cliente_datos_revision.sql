-- ConCasa CRM — P3J.4 RPC update_cliente_datos_revision (Mesa valida/rechaza datos generales)
-- Pendiente de aplicar en remoto (`supabase db push` / deploy) — no incluido en commit sin confirmación.

CREATE OR REPLACE FUNCTION public.update_cliente_datos_revision(
  p_expediente_id UUID,
  p_estado public.cliente_datos_estado,
  p_comentario_rechazo TEXT DEFAULT NULL
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
  v_row public.cliente_datos%ROWTYPE;
  v_estado_anterior public.cliente_datos_estado;
  v_comentario_final TEXT;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('mesa_admin', 'mesa_interno', 'mesa_externo', 'super_admin') THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_estado IS NULL THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: estado es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_estado NOT IN ('validado', 'rechazado') THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: estado no permitido (%)', p_estado
      USING ERRCODE = '22023';
  END IF;

  IF p_estado = 'rechazado' THEN
    IF p_comentario_rechazo IS NULL OR btrim(p_comentario_rechazo) = '' THEN
      RAISE EXCEPTION 'update_cliente_datos_revision: comentario_rechazo es obligatorio al rechazar'
        USING ERRCODE = '22023';
    END IF;
    v_comentario_final := btrim(p_comentario_rechazo);
  ELSE
    v_comentario_final := NULL;
  END IF;

  SELECT
    e.id,
    e.organization_id,
    e.submitted_to_mesa,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND OR v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role <> 'super_admin'
     AND v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: expediente fuera de la organización del actor'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_see_expediente(p_expediente_id) THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: no autorizado para operar este expediente'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_exp.submitted_to_mesa THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: el expediente aún no fue enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  SELECT cd.*
  INTO v_row
  FROM public.cliente_datos cd
  WHERE cd.expediente_id = p_expediente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: faltan datos del cliente'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.estado = 'pendiente' THEN
    RAISE EXCEPTION 'update_cliente_datos_revision: datos del cliente incompletos (pendiente)'
      USING ERRCODE = '22023';
  END IF;

  v_estado_anterior := v_row.estado;

  IF p_estado = 'validado' THEN
    UPDATE public.cliente_datos
    SET
      estado = 'validado',
      comentario_rechazo = NULL,
      validated_at = NOW(),
      validated_by = v_actor_id,
      rejected_at = NULL,
      rejected_by = NULL,
      updated_at = NOW()
    WHERE expediente_id = p_expediente_id;
  ELSE
    UPDATE public.cliente_datos
    SET
      estado = 'rechazado',
      comentario_rechazo = v_comentario_final,
      rejected_at = NOW(),
      rejected_by = v_actor_id,
      validated_at = NULL,
      validated_by = NULL,
      updated_at = NOW()
    WHERE expediente_id = p_expediente_id;
  END IF;

  PERFORM public.log_action(
    v_exp.organization_id,
    v_actor_id,
    v_actor_role,
    'cliente_datos.revision.update',
    'cliente_datos',
    p_expediente_id,
    jsonb_build_object(
      'expediente_id', p_expediente_id,
      'estado_anterior', v_estado_anterior,
      'estado_nuevo', p_estado,
      'comentario_rechazo', v_comentario_final
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expediente_id', p_expediente_id,
    'estado', p_estado,
    'comentario_rechazo', v_comentario_final
  );
END;
$$;

COMMENT ON FUNCTION public.update_cliente_datos_revision(UUID, public.cliente_datos_estado, TEXT) IS
  'Mesa valida/rechaza datos generales del cliente. Requiere submitted_to_mesa; no modifica documentos ni etapa.';

REVOKE ALL ON FUNCTION public.update_cliente_datos_revision(UUID, public.cliente_datos_estado, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_cliente_datos_revision(UUID, public.cliente_datos_estado, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.update_cliente_datos_revision(UUID, public.cliente_datos_estado, TEXT) TO authenticated;
