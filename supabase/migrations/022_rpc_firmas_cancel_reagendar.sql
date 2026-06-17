-- ConCasa CRM — P2C-19 RPC cancel_firmas y reagendar_firmas

-- =============================================================================
-- cancel_firmas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cancel_firmas(
  p_expediente_id UUID,
  p_motivo TEXT DEFAULT NULL
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
  v_booking RECORD;
  v_motivo TEXT;
  v_fecha_cita_anterior TIMESTAMPTZ;
  v_kind public.booking_kind := 'firmas';
  v_etapa_actual SMALLINT;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'cancel_firmas: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_firmas: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('asesor', 'mesa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'cancel_firmas: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'cancel_firmas: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');

  SELECT
    e.id,
    e.organization_id,
    e.asesor_id,
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
    RAISE EXCEPTION 'cancel_firmas: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'cancel_firmas: expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role <> 'super_admin'
     AND v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'cancel_firmas: expediente fuera de la organización del actor'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'asesor'
     AND v_exp.asesor_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'cancel_firmas: solo el asesor dueño puede cancelar firma'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role IN ('mesa_admin', 'super_admin')
     AND NOT public.can_see_expediente(p_expediente_id) THEN
    RAISE EXCEPTION 'cancel_firmas: no autorizado para operar este expediente'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'cancel_firmas: el expediente no está en ciclo activo'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RAISE EXCEPTION 'cancel_firmas: el expediente no ha sido enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.subestado <> 'en_proceso' THEN
    RAISE EXCEPTION 'cancel_firmas: subestado debe ser en_proceso (actual: %)', v_exp.subestado
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.etapa_actual NOT IN (9, 10) THEN
    RAISE EXCEPTION 'cancel_firmas: solo se puede cancelar en etapa 9 o 10 (actual: %)', v_exp.etapa_actual
      USING ERRCODE = '22023';
  END IF;

  SELECT
    b.id,
    b.booking_date,
    b.booking_time,
    b.location_id,
    b.note
  INTO v_booking
  FROM public.agenda_bookings b
  WHERE b.expediente_id = p_expediente_id
    AND b.kind = v_kind
    AND b.status = 'booked'
  ORDER BY b.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_firmas: no hay cita de firma activa para cancelar'
      USING ERRCODE = '22023';
  END IF;

  v_fecha_cita_anterior := v_exp.fecha_cita;
  v_etapa_actual := v_exp.etapa_actual;

  UPDATE public.agenda_bookings
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    note = CASE
      WHEN v_motivo IS NOT NULL THEN
        CASE
          WHEN note IS NULL OR btrim(note) = '' THEN 'Cancelado: ' || v_motivo
          ELSE note || E'\nCancelado: ' || v_motivo
        END
      ELSE note
    END
  WHERE id = v_booking.id;

  UPDATE public.expedientes
  SET
    fecha_cita = NULL,
    updated_at = NOW()
  WHERE id = p_expediente_id;

  PERFORM public.log_action(
    v_exp.organization_id,
    v_actor_id,
    v_actor_role,
    'agenda.firmas.cancel',
    'agenda_booking',
    v_booking.id,
    jsonb_build_object(
      'actor_id', v_actor_id,
      'actor_role', v_actor_role,
      'booking_id', v_booking.id,
      'expediente_id', p_expediente_id,
      'motivo', v_motivo,
      'etapa_actual', v_etapa_actual,
      'fecha_cita_anterior', v_fecha_cita_anterior,
      'no_etapa_change', true
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expediente_id', p_expediente_id,
    'booking_id', v_booking.id,
    'kind', v_kind,
    'status', 'cancelled',
    'fecha_cita', NULL,
    'etapa_actual', v_etapa_actual,
    'no_etapa_change', true
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_firmas(UUID, TEXT) IS
  'Asesor dueño o mesa_admin cancela cita firmas activa (etapa 9/10). Limpia fecha_cita; no cambia etapa.';

-- =============================================================================
-- reagendar_firmas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reagendar_firmas(
  p_expediente_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_location_id TEXT,
  p_note TEXT DEFAULT NULL
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
  v_booking_anterior_id UUID;
  v_booking_nuevo_id UUID;
  v_location_id TEXT;
  v_note TEXT;
  v_booking_date DATE;
  v_booking_time TIME;
  v_fecha_cita_anterior TIMESTAMPTZ;
  v_kind public.booking_kind := 'firmas';
  v_status public.booking_status := 'booked';
  v_agenda_meta JSONB;
  v_etapa_actual SMALLINT;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_firmas: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reagendar_firmas: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('asesor', 'mesa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'reagendar_firmas: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_firmas: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'reagendar_firmas: scheduled_at es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_location_id := NULLIF(btrim(COALESCE(p_location_id, '')), '');
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_firmas: location_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'reagendar_firmas: la cita debe ser en fecha/hora futura'
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
    e.fecha_cita,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reagendar_firmas: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'reagendar_firmas: expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role <> 'super_admin'
     AND v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'reagendar_firmas: expediente fuera de la organización del actor'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'asesor'
     AND v_exp.asesor_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'reagendar_firmas: solo el asesor dueño puede reagendar firma'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role IN ('mesa_admin', 'super_admin')
     AND NOT public.can_see_expediente(p_expediente_id) THEN
    RAISE EXCEPTION 'reagendar_firmas: no autorizado para operar este expediente'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'reagendar_firmas: el expediente no está en ciclo activo'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RAISE EXCEPTION 'reagendar_firmas: el expediente no ha sido enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.subestado <> 'en_proceso' THEN
    RAISE EXCEPTION 'reagendar_firmas: subestado debe ser en_proceso (actual: %)', v_exp.subestado
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.etapa_actual NOT IN (9, 10) THEN
    RAISE EXCEPTION 'reagendar_firmas: solo se puede reagendar en etapa 9 o 10 (actual: %)', v_exp.etapa_actual
      USING ERRCODE = '22023';
  END IF;

  SELECT b.id
  INTO v_booking_anterior_id
  FROM public.agenda_bookings b
  WHERE b.expediente_id = p_expediente_id
    AND b.kind = v_kind
    AND b.status = 'booked'
  ORDER BY b.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_booking_anterior_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_firmas: no hay cita de firma activa para reagendar'
      USING ERRCODE = '22023';
  END IF;

  v_fecha_cita_anterior := v_exp.fecha_cita;
  v_etapa_actual := v_exp.etapa_actual;

  UPDATE public.agenda_bookings
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    note = CASE
      WHEN note IS NULL OR btrim(note) = '' THEN 'Reagendada'
      ELSE note || E'\nReagendada'
    END
  WHERE id = v_booking_anterior_id;

  v_agenda_meta := public.agenda_firmas_assert_slot_available(
    v_exp.organization_id,
    p_scheduled_at,
    v_location_id
  );

  v_booking_date := (v_agenda_meta->>'booking_date')::DATE;
  v_booking_time := (v_agenda_meta->>'booking_time')::TIME;

  BEGIN
    INSERT INTO public.agenda_bookings (
      organization_id,
      kind,
      expediente_id,
      booking_date,
      booking_time,
      location_id,
      status,
      note,
      created_by
    ) VALUES (
      v_exp.organization_id,
      v_kind,
      p_expediente_id,
      v_booking_date,
      v_booking_time,
      v_location_id,
      v_status,
      v_note,
      v_actor_id
    )
    RETURNING id INTO v_booking_nuevo_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'reagendar_firmas: conflicto al crear la nueva cita de firma'
        USING ERRCODE = '22023';
  END;

  UPDATE public.expedientes
  SET
    fecha_cita = p_scheduled_at,
    updated_at = NOW()
  WHERE id = p_expediente_id;

  PERFORM public.log_action(
    v_exp.organization_id,
    v_actor_id,
    v_actor_role,
    'agenda.firmas.reagendar',
    'agenda_booking',
    v_booking_nuevo_id,
    jsonb_build_object(
      'actor_id', v_actor_id,
      'actor_role', v_actor_role,
      'old_booking_id', v_booking_anterior_id,
      'new_booking_id', v_booking_nuevo_id,
      'expediente_id', p_expediente_id,
      'old_fecha_cita', v_fecha_cita_anterior,
      'new_fecha_cita', p_scheduled_at,
      'booking_date', v_booking_date,
      'booking_time', v_booking_time,
      'location_id', v_location_id,
      'etapa_actual', v_etapa_actual,
      'no_etapa_change', true
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expediente_id', p_expediente_id,
    'old_booking_id', v_booking_anterior_id,
    'new_booking_id', v_booking_nuevo_id,
    'kind', v_kind,
    'scheduled_at', p_scheduled_at,
    'booking_date', v_booking_date,
    'booking_time', v_booking_time,
    'location_id', v_location_id,
    'fecha_cita', p_scheduled_at,
    'etapa_actual', v_etapa_actual,
    'no_etapa_change', true
  );
END;
$$;

COMMENT ON FUNCTION public.reagendar_firmas(UUID, TIMESTAMPTZ, TEXT, TEXT) IS
  'Asesor dueño o mesa_admin reagenda firmas (etapa 9/10): cancela booking activo, valida slot y crea uno nuevo. No cambia etapa.';

REVOKE ALL ON FUNCTION public.cancel_firmas(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_firmas(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reagendar_firmas(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reagendar_firmas(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.cancel_firmas(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reagendar_firmas(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
