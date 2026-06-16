-- ConCasa CRM — P2C-11 agenda_config rules para book_biometricos / reagendar_biometricos

-- =============================================================================
-- Normalización config legacy biométricos (minLeadDays / slotsPerDay → canónica)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.agenda_biometricos_normalize_config(p_config JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_config JSONB := COALESCE(p_config, '{}'::JSONB);
  v_defaults JSONB := jsonb_build_object(
    'enabled', true,
    'timezone', 'America/Monterrey',
    'min_lead_hours', 48,
    'allowed_weekdays', jsonb_build_array(1, 2, 3, 4, 5),
    'locations', jsonb_build_object(
      'mty-centro', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-centro', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-nueva', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-original', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-vieja', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-db-dup', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-forzada', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-reagenda', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'sede-avanzar', jsonb_build_object('enabled', true, 'capacity_per_slot', 4),
      'san-nicolas', jsonb_build_object('enabled', true, 'capacity_per_slot', 2)
    ),
    'slots', jsonb_build_array('09:00', '10:00', '11:00', '12:00')
  );
  v_min_lead_hours INTEGER;
BEGIN
  IF v_config ? 'min_lead_hours' THEN
    v_min_lead_hours := GREATEST((v_config->>'min_lead_hours')::INTEGER, 0);
  ELSIF v_config ? 'minLeadDays' THEN
    v_min_lead_hours := GREATEST((v_config->>'minLeadDays')::INTEGER, 0) * 24;
  ELSE
    v_min_lead_hours := (v_defaults->>'min_lead_hours')::INTEGER;
  END IF;

  v_config := v_config
    - 'minLeadDays'
    - 'slotsPerDay'
    || jsonb_build_object('min_lead_hours', v_min_lead_hours);

  IF NOT (v_config ? 'enabled') THEN
    v_config := v_config || jsonb_build_object('enabled', v_defaults->'enabled');
  END IF;

  IF NOT (v_config ? 'timezone')
     OR NULLIF(btrim(COALESCE(v_config->>'timezone', '')), '') IS NULL THEN
    v_config := v_config || jsonb_build_object('timezone', v_defaults->>'timezone');
  END IF;

  IF NOT (v_config ? 'allowed_weekdays') THEN
    v_config := v_config || jsonb_build_object('allowed_weekdays', v_defaults->'allowed_weekdays');
  END IF;

  IF NOT (v_config ? 'locations') THEN
    v_config := v_config || jsonb_build_object('locations', v_defaults->'locations');
  ELSIF jsonb_typeof(v_config->'locations') = 'object'
     AND v_config->'locations' <> '{}'::JSONB THEN
    v_config := v_config || jsonb_build_object(
      'locations', (v_defaults->'locations') || (v_config->'locations')
    );
  END IF;

  IF NOT (v_config ? 'slots') THEN
    v_config := v_config || jsonb_build_object('slots', v_defaults->'slots');
  END IF;

  RETURN v_config;
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_config_normalize_biometricos_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind = 'biometricos' THEN
    NEW.config := public.agenda_biometricos_normalize_config(NEW.config);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agenda_config_normalize_biometricos ON public.agenda_config;

CREATE TRIGGER agenda_config_normalize_biometricos
  BEFORE INSERT OR UPDATE ON public.agenda_config
  FOR EACH ROW
  WHEN (NEW.kind = 'biometricos')
  EXECUTE FUNCTION public.agenda_config_normalize_biometricos_trigger();

UPDATE public.agenda_config
SET config = public.agenda_biometricos_normalize_config(config)
WHERE kind = 'biometricos';

CREATE OR REPLACE FUNCTION public.agenda_biometricos_slot_ts(
  p_iso_dow INTEGER,
  p_slot TEXT,
  p_min_days INTEGER DEFAULT 3,
  p_tz TEXT DEFAULT 'America/Monterrey'
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_date DATE;
  v_parts TEXT[];
  v_hour INTEGER;
  v_minute INTEGER;
BEGIN
  v_date := ((NOW() AT TIME ZONE p_tz)::DATE + p_min_days);
  WHILE EXTRACT(ISODOW FROM v_date)::INTEGER <> p_iso_dow LOOP
    v_date := v_date + 1;
  END LOOP;

  v_parts := regexp_split_to_array(p_slot, ':');
  v_hour := v_parts[1]::INTEGER;
  v_minute := v_parts[2]::INTEGER;

  RETURN (v_date + make_time(v_hour, v_minute, 0)) AT TIME ZONE p_tz;
END;
$$;

-- =============================================================================
-- Helpers agenda_config biométricos
-- =============================================================================
CREATE OR REPLACE FUNCTION public.agenda_biometricos_min_lead_hours(p_config JSONB)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST((p_config->>'min_lead_hours')::INTEGER, 0);
$$;

CREATE OR REPLACE FUNCTION public.agenda_biometricos_count_slot_booked(
  p_org_id UUID,
  p_booking_date DATE,
  p_booking_time TIME,
  p_location_id TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.agenda_bookings b
  WHERE b.organization_id = p_org_id
    AND b.kind = 'biometricos'
    AND b.status = 'booked'
    AND b.booking_date = p_booking_date
    AND b.booking_time = p_booking_time
    AND b.location_id = p_location_id;
$$;

CREATE OR REPLACE FUNCTION public.agenda_biometricos_assert_slot_available(
  p_org_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_location_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.agenda_config%ROWTYPE;
  v_config JSONB;
  v_tz TEXT;
  v_local_ts TIMESTAMP;
  v_booking_date DATE;
  v_booking_time TIME;
  v_time_label TEXT;
  v_min_lead_hours INTEGER;
  v_iso_dow INTEGER;
  v_slot TEXT;
  v_slot_allowed BOOLEAN := false;
  v_location_cfg JSONB;
  v_capacity INTEGER;
  v_booked_count INTEGER;
BEGIN
  SELECT ac.*
  INTO v_row
  FROM public.agenda_config ac
  WHERE ac.organization_id = p_org_id
    AND ac.kind = 'biometricos';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda_config: configuración biométricos no encontrada'
      USING ERRCODE = '22023';
  END IF;

  v_config := public.agenda_biometricos_normalize_config(v_row.config);

  IF COALESCE((v_config->>'enabled')::BOOLEAN, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'agenda_config: agenda biométricos deshabilitada'
      USING ERRCODE = '22023';
  END IF;

  v_tz := NULLIF(btrim(COALESCE(v_config->>'timezone', '')), '');
  IF v_tz IS NULL THEN
    RAISE EXCEPTION 'agenda_config: timezone no configurado'
      USING ERRCODE = '22023';
  END IF;

  v_local_ts := p_scheduled_at AT TIME ZONE v_tz;
  v_booking_date := v_local_ts::DATE;
  v_booking_time := v_local_ts::TIME;
  v_time_label := to_char(v_local_ts, 'HH24:MI');

  v_min_lead_hours := public.agenda_biometricos_min_lead_hours(v_config);
  IF p_scheduled_at < NOW() + (v_min_lead_hours || ' hours')::INTERVAL THEN
    RAISE EXCEPTION 'agenda_config: fecha no cumple anticipación mínima'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (v_config ? 'allowed_weekdays')
     OR jsonb_typeof(v_config->'allowed_weekdays') <> 'array'
     OR jsonb_array_length(v_config->'allowed_weekdays') = 0 THEN
    RAISE EXCEPTION 'agenda_config: días no configurados'
      USING ERRCODE = '22023';
  END IF;

  v_iso_dow := EXTRACT(ISODOW FROM v_local_ts)::INTEGER;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_config->'allowed_weekdays') elem
    WHERE (elem #>> '{}')::INTEGER = v_iso_dow
  ) THEN
    RAISE EXCEPTION 'agenda_config: día no permitido'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (v_config ? 'slots')
     OR jsonb_typeof(v_config->'slots') <> 'array'
     OR jsonb_array_length(v_config->'slots') = 0 THEN
    RAISE EXCEPTION 'agenda_config: horarios no configurados'
      USING ERRCODE = '22023';
  END IF;

  FOR v_slot IN
    SELECT jsonb_array_elements_text(v_config->'slots')
  LOOP
    IF v_time_label = v_slot THEN
      v_slot_allowed := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_slot_allowed THEN
    RAISE EXCEPTION 'agenda_config: horario no permitido'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (v_config ? 'locations')
     OR jsonb_typeof(v_config->'locations') <> 'object'
     OR v_config->'locations' = '{}'::JSONB THEN
    RAISE EXCEPTION 'agenda_config: sedes no configuradas'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (v_config->'locations' ? p_location_id) THEN
    RAISE EXCEPTION 'agenda_config: sede no permitida'
      USING ERRCODE = '22023';
  END IF;

  v_location_cfg := v_config->'locations'->p_location_id;
  IF COALESCE((v_location_cfg->>'enabled')::BOOLEAN, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'agenda_config: sede deshabilitada'
      USING ERRCODE = '22023';
  END IF;

  v_capacity := COALESCE((v_location_cfg->>'capacity_per_slot')::INTEGER, 1);

  IF v_capacity < 1 THEN
    v_capacity := 1;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(
      p_org_id::TEXT || ':' || v_booking_date::TEXT || ':' || v_time_label || ':' || p_location_id
    )
  );

  v_booked_count := public.agenda_biometricos_count_slot_booked(
    p_org_id,
    v_booking_date,
    v_booking_time,
    p_location_id
  );

  IF v_booked_count >= v_capacity THEN
    RAISE EXCEPTION 'agenda_config: cupo agotado'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'agenda_config_applied', true,
    'timezone', v_tz,
    'booking_date', v_booking_date,
    'booking_time', v_booking_time,
    'location_id', p_location_id,
    'capacity_per_slot', v_capacity,
    'booked_count_before', v_booked_count
  );
END;
$$;

-- =============================================================================
-- book_biometricos (P2C-11: agenda_config)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.book_biometricos(
  p_expediente_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_location_id TEXT DEFAULT NULL,
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
  v_booking_id UUID;
  v_location_id TEXT;
  v_note TEXT;
  v_booking_date DATE;
  v_booking_time TIME;
  v_kind public.booking_kind := 'biometricos';
  v_status public.booking_status := 'booked';
  v_agenda_meta JSONB;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'book_biometricos: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'book_biometricos: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role <> 'asesor' THEN
    RAISE EXCEPTION 'book_biometricos: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'book_biometricos: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'book_biometricos: scheduled_at es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_location_id := NULLIF(btrim(COALESCE(p_location_id, '')), '');
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'book_biometricos: location_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'book_biometricos: la cita debe ser en fecha/hora futura'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    e.id,
    e.organization_id,
    e.asesor_id,
    e.ciclo_estado,
    e.submitted_to_mesa,
    e.etapa_actual,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'book_biometricos: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'book_biometricos: expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'book_biometricos: expediente fuera de la organización del asesor'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.asesor_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'book_biometricos: solo el asesor dueño puede agendar biométricos'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'book_biometricos: el expediente no está en ciclo activo'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RAISE EXCEPTION 'book_biometricos: el expediente no ha sido enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.etapa_actual <> 4 THEN
    RAISE EXCEPTION 'book_biometricos: solo se puede agendar en etapa 4 (actual: %)', v_exp.etapa_actual
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda_bookings b
    WHERE b.expediente_id = p_expediente_id
      AND b.kind = v_kind
      AND b.status = 'booked'
  ) THEN
    RAISE EXCEPTION 'book_biometricos: ya existe una cita biométrica activa para este expediente'
      USING ERRCODE = '22023';
  END IF;

  v_agenda_meta := public.agenda_biometricos_assert_slot_available(
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
    RETURNING id INTO v_booking_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'book_biometricos: ya existe una cita biométrica activa para este expediente'
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
    'agenda.biometricos.book',
    'agenda_booking',
    v_booking_id,
    jsonb_build_object(
      'expediente_id', p_expediente_id,
      'asesor_id', v_exp.asesor_id,
      'organization_id', v_exp.organization_id,
      'scheduled_at', p_scheduled_at,
      'booking_date', v_booking_date,
      'booking_time', v_booking_time,
      'location_id', v_location_id,
      'note', v_note,
      'booking_kind', v_kind,
      'booking_status', v_status,
      'agenda_config_applied', true,
      'capacity_per_slot', v_agenda_meta->'capacity_per_slot',
      'booked_count_before', v_agenda_meta->'booked_count_before'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'expediente_id', p_expediente_id,
    'scheduled_at', p_scheduled_at,
    'booking_date', v_booking_date,
    'booking_time', v_booking_time,
    'location_id', v_location_id,
    'status', v_status,
    'kind', v_kind,
    'etapa_actual', 4
  );
END;
$$;

-- =============================================================================
-- reagendar_biometricos (P2C-11: agenda_config)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reagendar_biometricos(
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
  v_kind public.booking_kind := 'biometricos';
  v_status public.booking_status := 'booked';
  v_agenda_meta JSONB;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_biometricos: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reagendar_biometricos: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role <> 'asesor' THEN
    RAISE EXCEPTION 'reagendar_biometricos: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_biometricos: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'reagendar_biometricos: scheduled_at es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_location_id := NULLIF(btrim(COALESCE(p_location_id, '')), '');
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_biometricos: location_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'reagendar_biometricos: la cita debe ser en fecha/hora futura'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    e.id,
    e.organization_id,
    e.asesor_id,
    e.ciclo_estado,
    e.submitted_to_mesa,
    e.etapa_actual,
    e.fecha_cita,
    e.deleted_at
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reagendar_biometricos: expediente no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'reagendar_biometricos: expediente no disponible'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_exp.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'reagendar_biometricos: expediente fuera de la organización del asesor'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.asesor_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'reagendar_biometricos: solo el asesor dueño puede reagendar biométricos'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'reagendar_biometricos: el expediente no está en ciclo activo'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.submitted_to_mesa IS NOT TRUE THEN
    RAISE EXCEPTION 'reagendar_biometricos: el expediente no ha sido enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.etapa_actual <> 4 THEN
    RAISE EXCEPTION 'reagendar_biometricos: solo se puede reagendar en etapa 4 (actual: %)', v_exp.etapa_actual
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
    RAISE EXCEPTION 'reagendar_biometricos: no hay cita biométrica activa para reagendar'
      USING ERRCODE = '22023';
  END IF;

  v_fecha_cita_anterior := v_exp.fecha_cita;

  UPDATE public.agenda_bookings
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    note = CASE
      WHEN note IS NULL OR btrim(note) = '' THEN 'Reagendado'
      ELSE note || E'\nReagendado'
    END
  WHERE id = v_booking_anterior_id;

  v_agenda_meta := public.agenda_biometricos_assert_slot_available(
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
      RAISE EXCEPTION 'reagendar_biometricos: conflicto al crear la nueva cita biométrica'
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
    'agenda.biometricos.reagendar',
    'agenda_booking',
    v_booking_nuevo_id,
    jsonb_build_object(
      'expediente_id', p_expediente_id,
      'booking_anterior_id', v_booking_anterior_id,
      'booking_nuevo_id', v_booking_nuevo_id,
      'fecha_cita_anterior', v_fecha_cita_anterior,
      'fecha_cita_nueva', p_scheduled_at,
      'booking_date', v_booking_date,
      'booking_time', v_booking_time,
      'location_id', v_location_id,
      'note', v_note,
      'agenda_config_applied', true,
      'capacity_per_slot', v_agenda_meta->'capacity_per_slot',
      'booked_count_before', v_agenda_meta->'booked_count_before'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expediente_id', p_expediente_id,
    'booking_anterior_id', v_booking_anterior_id,
    'booking_nuevo_id', v_booking_nuevo_id,
    'scheduled_at', p_scheduled_at,
    'booking_date', v_booking_date,
    'booking_time', v_booking_time,
    'location_id', v_location_id,
    'status', v_status,
    'kind', v_kind,
    'etapa_actual', 4
  );
END;
$$;

COMMENT ON FUNCTION public.agenda_biometricos_assert_slot_available(UUID, TIMESTAMPTZ, TEXT) IS
  'Valida agenda_config biométricos (anticipación, día, slot, sede, cupo) y aplica lock transaccional por slot.';

COMMENT ON FUNCTION public.book_biometricos(UUID, TIMESTAMPTZ, TEXT, TEXT) IS
  'Asesor dueño agenda cita biométricos (etapa 4) con reglas agenda_config. No avanza etapa.';

COMMENT ON FUNCTION public.reagendar_biometricos(UUID, TIMESTAMPTZ, TEXT, TEXT) IS
  'Asesor dueño reagenda biométricos (etapa 4) con reglas agenda_config. Cancela booking activo y crea uno nuevo.';
