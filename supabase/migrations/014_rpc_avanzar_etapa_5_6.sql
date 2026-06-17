-- ConCasa CRM — P2C-13 extender avanzar_etapa_operativa (transición 5→6)

-- =============================================================================
-- avanzar_etapa_operativa (transiciones 1→2, 2→3, 3→4, 4→5 y 5→6)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.avanzar_etapa_operativa(
  p_expediente_id UUID,
  p_comentario TEXT DEFAULT NULL
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
  v_cliente public.cliente_datos%ROWTYPE;
  v_docs_validados INTEGER;
  v_subestado_anterior public.operativo_subestado;
  v_comentario_final TEXT;
  v_subestado_nuevo public.operativo_subestado := 'en_proceso';
  v_booking_id UUID;
  v_fecha_cita TIMESTAMPTZ;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('mesa_admin', 'mesa_interno', 'mesa_externo', 'super_admin') THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_comentario_final := NULLIF(btrim(COALESCE(p_comentario, '')), '');

  SELECT
    e.id,
    e.organization_id,
    e.ciclo_estado,
    e.submitted_to_mesa,
    e.etapa_actual,
    e.subestado,
    e.fecha_cita,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role <> 'super_admin'
     AND v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: expediente fuera de la organización del actor'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_see_expediente(p_expediente_id) THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: no autorizado para operar este expediente'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: el expediente no está en ciclo activo'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RAISE EXCEPTION 'avanzar_etapa_operativa: el expediente no ha sido enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.etapa_actual = 1 THEN
    IF v_exp.subestado <> 'en_validacion_mesa' THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: subestado debe ser en_validacion_mesa (actual: %)', v_exp.subestado
        USING ERRCODE = '22023';
    END IF;

    SELECT cd.*
    INTO v_cliente
    FROM public.cliente_datos cd
    WHERE cd.expediente_id = p_expediente_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: faltan datos del cliente'
        USING ERRCODE = '22023';
    END IF;

    IF v_cliente.estado <> 'validado' THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: datos del cliente deben estar validados por Mesa (actual: %)', v_cliente.estado
        USING ERRCODE = '22023';
    END IF;

    v_docs_validados := public.count_integration_docs_validados(p_expediente_id);

    IF NOT public.integration_docs_todos_validados(p_expediente_id) THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: faltan documentos obligatorios validados (% de %)', v_docs_validados, cardinality(public.integration_doc_tipos_obligatorios())
        USING ERRCODE = '22023';
    END IF;

    v_subestado_anterior := v_exp.subestado;

    UPDATE public.expedientes
    SET
      etapa_actual = 2,
      subestado = v_subestado_nuevo,
      updated_at = NOW()
    WHERE id = p_expediente_id;

    PERFORM public.log_action(
      v_exp.organization_id,
      v_actor_id,
      v_actor_role,
      'expediente.avanzar_etapa_operativa',
      'expediente',
      p_expediente_id,
      jsonb_build_object(
        'actor_id', v_actor_id,
        'actor_role', v_actor_role,
        'etapa_anterior', 1,
        'etapa_nueva', 2,
        'subestado_anterior', v_subestado_anterior,
        'subestado_nuevo', v_subestado_nuevo,
        'comentario', v_comentario_final,
        'documentos_obligatorios_validados_count', v_docs_validados
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'expediente_id', p_expediente_id,
      'etapa_anterior', 1,
      'etapa_actual', 2,
      'subestado', v_subestado_nuevo,
      'operativo_subestado', v_subestado_nuevo,
      'documentos_obligatorios_validados_count', v_docs_validados
    );
  ELSIF v_exp.etapa_actual = 2 THEN
    IF v_exp.subestado <> 'en_proceso' THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: subestado debe ser en_proceso (actual: %)', v_exp.subestado
        USING ERRCODE = '22023';
    END IF;

    v_subestado_anterior := v_exp.subestado;

    UPDATE public.expedientes
    SET
      etapa_actual = 3,
      subestado = v_subestado_nuevo,
      updated_at = NOW()
    WHERE id = p_expediente_id;

    PERFORM public.log_action(
      v_exp.organization_id,
      v_actor_id,
      v_actor_role,
      'expediente.avanzar_etapa_operativa',
      'expediente',
      p_expediente_id,
      jsonb_build_object(
        'actor_id', v_actor_id,
        'actor_role', v_actor_role,
        'etapa_anterior', 2,
        'etapa_nueva', 3,
        'subestado_anterior', v_subestado_anterior,
        'subestado_nuevo', v_subestado_nuevo,
        'comentario', v_comentario_final,
        'transition', '2_3'
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'expediente_id', p_expediente_id,
      'etapa_anterior', 2,
      'etapa_actual', 3,
      'subestado', v_subestado_nuevo,
      'operativo_subestado', v_subestado_nuevo,
      'comentario', v_comentario_final
    );
  ELSIF v_exp.etapa_actual = 3 THEN
    IF v_exp.subestado <> 'en_proceso' THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: subestado debe ser en_proceso (actual: %)', v_exp.subestado
        USING ERRCODE = '22023';
    END IF;

    v_subestado_anterior := v_exp.subestado;

    UPDATE public.expedientes
    SET
      etapa_actual = 4,
      subestado = v_subestado_nuevo,
      updated_at = NOW()
    WHERE id = p_expediente_id;

    PERFORM public.log_action(
      v_exp.organization_id,
      v_actor_id,
      v_actor_role,
      'expediente.avanzar_etapa_operativa',
      'expediente',
      p_expediente_id,
      jsonb_build_object(
        'actor_id', v_actor_id,
        'actor_role', v_actor_role,
        'etapa_anterior', 3,
        'etapa_nueva', 4,
        'subestado_anterior', v_subestado_anterior,
        'subestado_nuevo', v_subestado_nuevo,
        'comentario', v_comentario_final,
        'transition', '3_4'
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'expediente_id', p_expediente_id,
      'etapa_anterior', 3,
      'etapa_actual', 4,
      'subestado', v_subestado_nuevo,
      'operativo_subestado', v_subestado_nuevo,
      'comentario', v_comentario_final
    );
  ELSIF v_exp.etapa_actual = 4 THEN
    v_fecha_cita := v_exp.fecha_cita;

    IF v_fecha_cita IS NULL THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: falta fecha de cita biométrica'
        USING ERRCODE = '22023';
    END IF;

    SELECT b.id
    INTO v_booking_id
    FROM public.agenda_bookings b
    WHERE b.expediente_id = p_expediente_id
      AND b.kind = 'biometricos'
      AND b.status = 'booked'
    ORDER BY b.created_at DESC
    LIMIT 1;

    IF v_booking_id IS NULL THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: falta booking biométrico activo'
        USING ERRCODE = '22023';
    END IF;

    v_subestado_anterior := v_exp.subestado;

    UPDATE public.expedientes
    SET
      etapa_actual = 5,
      subestado = v_subestado_nuevo,
      updated_at = NOW()
    WHERE id = p_expediente_id;

    PERFORM public.log_action(
      v_exp.organization_id,
      v_actor_id,
      v_actor_role,
      'expediente.avanzar_etapa_operativa',
      'expediente',
      p_expediente_id,
      jsonb_build_object(
        'actor_id', v_actor_id,
        'actor_role', v_actor_role,
        'etapa_anterior', 4,
        'etapa_nueva', 5,
        'subestado_anterior', v_subestado_anterior,
        'subestado_nuevo', v_subestado_nuevo,
        'booking_id', v_booking_id,
        'fecha_cita', v_fecha_cita,
        'comentario', v_comentario_final
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'expediente_id', p_expediente_id,
      'etapa_anterior', 4,
      'etapa_actual', 5,
      'subestado', v_subestado_nuevo,
      'operativo_subestado', v_subestado_nuevo,
      'booking_id', v_booking_id,
      'fecha_cita', v_fecha_cita
    );
  ELSIF v_exp.etapa_actual = 5 THEN
    IF v_exp.subestado <> 'en_proceso' THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: subestado debe ser en_proceso (actual: %)', v_exp.subestado
        USING ERRCODE = '22023';
    END IF;

    v_fecha_cita := v_exp.fecha_cita;

    IF v_fecha_cita IS NULL THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: falta fecha de cita biométrica'
        USING ERRCODE = '22023';
    END IF;

    IF v_fecha_cita > NOW() THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: cita biométrica aún no ha ocurrido'
        USING ERRCODE = '22023';
    END IF;

    SELECT b.id
    INTO v_booking_id
    FROM public.agenda_bookings b
    WHERE b.expediente_id = p_expediente_id
      AND b.kind = 'biometricos'
      AND b.status = 'booked'
    ORDER BY b.created_at DESC
    LIMIT 1;

    IF v_booking_id IS NULL THEN
      RAISE EXCEPTION 'avanzar_etapa_operativa: falta booking biométrico activo'
        USING ERRCODE = '22023';
    END IF;

    v_subestado_anterior := v_exp.subestado;

    UPDATE public.expedientes
    SET
      etapa_actual = 6,
      subestado = v_subestado_nuevo,
      updated_at = NOW()
    WHERE id = p_expediente_id;

    PERFORM public.log_action(
      v_exp.organization_id,
      v_actor_id,
      v_actor_role,
      'expediente.avanzar_etapa_operativa',
      'expediente',
      p_expediente_id,
      jsonb_build_object(
        'actor_id', v_actor_id,
        'actor_role', v_actor_role,
        'etapa_anterior', 5,
        'etapa_nueva', 6,
        'subestado_anterior', v_subestado_anterior,
        'subestado_nuevo', v_subestado_nuevo,
        'booking_id', v_booking_id,
        'fecha_cita', v_fecha_cita,
        'comentario', v_comentario_final,
        'transition', '5_6'
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'expediente_id', p_expediente_id,
      'etapa_anterior', 5,
      'etapa_actual', 6,
      'subestado', v_subestado_nuevo,
      'operativo_subestado', v_subestado_nuevo,
      'comentario', v_comentario_final,
      'booking_id', v_booking_id,
      'fecha_cita', v_fecha_cita
    );
  ELSE
    RAISE EXCEPTION 'avanzar_etapa_operativa: transición no permitida desde etapa %', v_exp.etapa_actual
      USING ERRCODE = '22023';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.avanzar_etapa_operativa(UUID, TEXT) IS
  'Mesa avanza expediente 1→2, 2→3, 3→4, 4→5 o 5→6. Otras transiciones no permitidas.';

REVOKE ALL ON FUNCTION public.avanzar_etapa_operativa(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avanzar_etapa_operativa(UUID, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.avanzar_etapa_operativa(UUID, TEXT) TO authenticated;
