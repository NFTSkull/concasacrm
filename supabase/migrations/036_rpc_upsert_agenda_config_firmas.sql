-- ConCasa CRM — P3P.1A RPC upsert_agenda_config_firmas (config disponibilidad firmas)

-- =============================================================================
-- agenda_firmas_validate_config — validación estricta pre-persistencia
-- =============================================================================
CREATE OR REPLACE FUNCTION public.agenda_firmas_validate_config(p_config JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key TEXT;
  v_enabled BOOLEAN;
  v_timezone TEXT;
  v_min_lead_hours INTEGER;
  v_weekday INTEGER;
  v_weekdays JSONB;
  v_seen_weekdays INTEGER[] := ARRAY[]::INTEGER[];
  v_slot TEXT;
  v_slots JSONB;
  v_seen_slots TEXT[] := ARRAY[]::TEXT[];
  v_locations JSONB;
  v_location_id TEXT;
  v_location_cfg JSONB;
  v_loc_key TEXT;
  v_capacity INTEGER;
  v_has_enabled_location BOOLEAN := false;
BEGIN
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: config debe ser un objeto JSON'
      USING ERRCODE = '22023';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_config) LOOP
    IF v_key NOT IN ('enabled', 'timezone', 'min_lead_hours', 'allowed_weekdays', 'slots', 'locations') THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: clave no permitida en config: %', v_key
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF NOT (p_config ? 'enabled') OR jsonb_typeof(p_config->'enabled') <> 'boolean' THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: enabled debe ser boolean'
      USING ERRCODE = '22023';
  END IF;
  v_enabled := (p_config->>'enabled')::BOOLEAN;

  IF NOT (p_config ? 'timezone')
     OR jsonb_typeof(p_config->'timezone') <> 'string'
     OR NULLIF(btrim(p_config->>'timezone'), '') IS NULL THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: timezone es obligatorio'
      USING ERRCODE = '22023';
  END IF;
  v_timezone := btrim(p_config->>'timezone');
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone) THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: timezone inválido: %', v_timezone
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_config ? 'min_lead_hours')
     OR jsonb_typeof(p_config->'min_lead_hours') NOT IN ('number', 'string') THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: min_lead_hours es obligatorio'
      USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_min_lead_hours := (p_config->>'min_lead_hours')::INTEGER;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: min_lead_hours debe ser entero'
        USING ERRCODE = '22023';
  END;
  IF v_min_lead_hours < 0 THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: min_lead_hours debe ser >= 0'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_config ? 'allowed_weekdays')
     OR jsonb_typeof(p_config->'allowed_weekdays') <> 'array'
     OR jsonb_array_length(p_config->'allowed_weekdays') = 0 THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: allowed_weekdays no puede estar vacío'
      USING ERRCODE = '22023';
  END IF;
  v_weekdays := p_config->'allowed_weekdays';
  FOR v_weekday IN
    SELECT (elem #>> '{}')::INTEGER
    FROM jsonb_array_elements(v_weekdays) elem
  LOOP
    IF v_weekday < 1 OR v_weekday > 7 THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: allowed_weekdays fuera de rango 1-7'
        USING ERRCODE = '22023';
    END IF;
    IF v_weekday = ANY (v_seen_weekdays) THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: allowed_weekdays con duplicados'
        USING ERRCODE = '22023';
    END IF;
    v_seen_weekdays := array_append(v_seen_weekdays, v_weekday);
  END LOOP;

  IF NOT (p_config ? 'slots')
     OR jsonb_typeof(p_config->'slots') <> 'array'
     OR jsonb_array_length(p_config->'slots') = 0 THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: slots no puede estar vacío'
      USING ERRCODE = '22023';
  END IF;
  v_slots := p_config->'slots';
  FOR v_slot IN SELECT jsonb_array_elements_text(v_slots) LOOP
    IF v_slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: slot inválido: %', v_slot
        USING ERRCODE = '22023';
    END IF;
    IF v_slot = ANY (v_seen_slots) THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: slots con duplicados'
        USING ERRCODE = '22023';
    END IF;
    v_seen_slots := array_append(v_seen_slots, v_slot);
  END LOOP;

  IF NOT (p_config ? 'locations') OR jsonb_typeof(p_config->'locations') <> 'object' THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: locations debe ser un objeto'
      USING ERRCODE = '22023';
  END IF;
  v_locations := p_config->'locations';

  IF v_enabled AND (v_locations = '{}'::JSONB OR v_locations IS NULL) THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: locations no puede estar vacío si enabled=true'
      USING ERRCODE = '22023';
  END IF;

  FOR v_location_id, v_location_cfg IN
    SELECT key, value FROM jsonb_each(v_locations)
  LOOP
    IF v_location_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: location_id inválido: %', v_location_id
        USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_location_cfg) <> 'object' THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: location debe ser objeto: %', v_location_id
        USING ERRCODE = '22023';
    END IF;
    FOR v_loc_key IN SELECT jsonb_object_keys(v_location_cfg) LOOP
      IF v_loc_key NOT IN ('enabled', 'capacity_per_slot', 'label') THEN
        RAISE EXCEPTION 'upsert_agenda_config_firmas: clave no permitida en location %: %',
          v_location_id, v_loc_key
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF NOT (v_location_cfg ? 'enabled') OR jsonb_typeof(v_location_cfg->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: location.enabled debe ser boolean (%)', v_location_id
        USING ERRCODE = '22023';
    END IF;
    IF NOT (v_location_cfg ? 'capacity_per_slot')
       OR jsonb_typeof(v_location_cfg->'capacity_per_slot') NOT IN ('number', 'string') THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: capacity_per_slot es obligatorio (%)', v_location_id
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_capacity := (v_location_cfg->>'capacity_per_slot')::INTEGER;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'upsert_agenda_config_firmas: capacity_per_slot debe ser entero (%)', v_location_id
          USING ERRCODE = '22023';
    END;
    IF v_capacity < 1 THEN
      RAISE EXCEPTION 'upsert_agenda_config_firmas: capacity_per_slot debe ser >= 1 (%)', v_location_id
        USING ERRCODE = '22023';
    END IF;
    IF (v_location_cfg->>'enabled')::BOOLEAN THEN
      v_has_enabled_location := true;
    END IF;
  END LOOP;

  IF v_enabled AND NOT v_has_enabled_location THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: al menos una sede debe estar enabled=true'
      USING ERRCODE = '22023';
  END IF;

  RETURN p_config;
END;
$$;

COMMENT ON FUNCTION public.agenda_firmas_validate_config(JSONB) IS
  'Valida estructura canónica de agenda_config firmas antes de upsert (P3P.1).';

-- =============================================================================
-- agenda_firmas_config_upsert_warnings — bookings futuros vs nueva config
-- =============================================================================
CREATE OR REPLACE FUNCTION public.agenda_firmas_config_upsert_warnings(
  p_org_id UUID,
  p_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config JSONB;
  v_tz TEXT;
  v_now_local TIMESTAMP;
  v_booking RECORD;
  v_time_label TEXT;
  v_iso_dow INTEGER;
  v_slot_allowed BOOLEAN;
  v_slot TEXT;
  v_location_cfg JSONB;
  v_capacity INTEGER;
  v_booked_count INTEGER;
  v_warnings JSONB := '[]'::JSONB;
BEGIN
  v_config := public.agenda_firmas_normalize_config(p_config);
  v_tz := v_config->>'timezone';
  v_now_local := NOW() AT TIME ZONE v_tz;

  IF COALESCE((v_config->>'enabled')::BOOLEAN, true) IS NOT TRUE THEN
    IF EXISTS (
      SELECT 1
      FROM public.agenda_bookings b
      WHERE b.organization_id = p_org_id
        AND b.kind = 'firmas'
        AND b.status = 'booked'
        AND (b.booking_date > v_now_local::DATE
          OR (b.booking_date = v_now_local::DATE AND b.booking_time >= v_now_local::TIME))
    ) THEN
      v_warnings := v_warnings || jsonb_build_array(
        'agenda firmas deshabilitada con citas futuras activas'
      );
    END IF;
    RETURN v_warnings;
  END IF;

  FOR v_booking IN
    SELECT
      b.id,
      b.expediente_id,
      b.booking_date,
      b.booking_time,
      b.location_id
    FROM public.agenda_bookings b
    WHERE b.organization_id = p_org_id
      AND b.kind = 'firmas'
      AND b.status = 'booked'
      AND (b.booking_date > v_now_local::DATE
        OR (b.booking_date = v_now_local::DATE AND b.booking_time >= v_now_local::TIME))
  LOOP
    v_time_label := to_char(v_booking.booking_time, 'HH24:MI');
    v_iso_dow := EXTRACT(ISODOW FROM v_booking.booking_date)::INTEGER;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_config->'allowed_weekdays') elem
      WHERE (elem #>> '{}')::INTEGER = v_iso_dow
    ) THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          'booking %s: día %s ya no permitido en allowed_weekdays',
          v_booking.id, v_iso_dow
        )
      );
    END IF;

    v_slot_allowed := false;
    FOR v_slot IN SELECT jsonb_array_elements_text(v_config->'slots') LOOP
      IF v_slot = v_time_label THEN
        v_slot_allowed := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_slot_allowed THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          'booking %s: horario %s ya no está en slots',
          v_booking.id, v_time_label
        )
      );
    END IF;

    IF NOT (v_config->'locations' ? v_booking.location_id) THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          'booking %s: sede %s ya no existe en locations',
          v_booking.id, v_booking.location_id
        )
      );
    ELSE
      v_location_cfg := v_config->'locations'->v_booking.location_id;
      IF COALESCE((v_location_cfg->>'enabled')::BOOLEAN, true) IS NOT TRUE THEN
        v_warnings := v_warnings || jsonb_build_array(
          format(
            'booking %s: sede %s deshabilitada',
            v_booking.id, v_booking.location_id
          )
        );
      ELSE
        v_capacity := COALESCE((v_location_cfg->>'capacity_per_slot')::INTEGER, 1);
        v_booked_count := public.agenda_firmas_count_slot_booked(
          p_org_id,
          v_booking.booking_date,
          v_booking.booking_time,
          v_booking.location_id
        );
        IF v_booked_count > v_capacity THEN
          v_warnings := v_warnings || jsonb_build_array(
            format(
              'booking %s: cupo excedido en %s %s %s (%s > %s)',
              v_booking.id,
              v_booking.location_id,
              v_booking.booking_date,
              v_time_label,
              v_booked_count,
              v_capacity
            )
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_warnings;
END;
$$;

COMMENT ON FUNCTION public.agenda_firmas_config_upsert_warnings(UUID, JSONB) IS
  'Advertencias no bloqueantes si un upsert reduce disponibilidad con bookings firmas futuros activos.';

-- =============================================================================
-- upsert_agenda_config_firmas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_agenda_config_firmas(
  p_config JSONB,
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role public.app_role;
  v_actor_org UUID;
  v_target_org UUID;
  v_preprocessed JSONB;
  v_validated JSONB;
  v_normalized JSONB;
  v_row public.agenda_config%ROWTYPE;
  v_created BOOLEAN;
  v_existed_before BOOLEAN;
  v_warnings JSONB;
  v_location_ids JSONB;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_actor_org
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('mesa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_organization_id IS NULL THEN
    v_target_org := v_actor_org;
  ELSIF v_actor_role = 'super_admin' THEN
    v_target_org := p_organization_id;
  ELSIF p_organization_id IS DISTINCT FROM v_actor_org THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: mesa_admin no puede configurar otra organización'
      USING ERRCODE = '42501';
  ELSE
    v_target_org := v_actor_org;
  END IF;

  IF v_target_org IS NULL THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: organization_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = v_target_org
      AND o.active = true
  ) THEN
    RAISE EXCEPTION 'upsert_agenda_config_firmas: organización no encontrada o inactiva'
      USING ERRCODE = 'P0002';
  END IF;

  v_preprocessed := public.agenda_firmas_normalize_config(COALESCE(p_config, '{}'::jsonb));
  v_validated := public.agenda_firmas_validate_config(v_preprocessed);
  v_normalized := public.agenda_firmas_normalize_config(v_validated);
  v_warnings := public.agenda_firmas_config_upsert_warnings(v_target_org, v_normalized);

  SELECT EXISTS (
    SELECT 1
    FROM public.agenda_config ac
    WHERE ac.organization_id = v_target_org
      AND ac.kind = 'firmas'
  ) INTO v_existed_before;

  INSERT INTO public.agenda_config (
    organization_id,
    kind,
    config,
    updated_by
  ) VALUES (
    v_target_org,
    'firmas',
    v_normalized,
    v_actor_id
  )
  ON CONFLICT (organization_id, kind) DO UPDATE SET
    config = EXCLUDED.config,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
  RETURNING * INTO v_row;

  v_created := NOT v_existed_before;

  SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::JSONB)
  INTO v_location_ids
  FROM jsonb_object_keys(v_normalized->'locations') AS key;

  PERFORM public.log_action(
    v_target_org,
    v_actor_id,
    v_actor_role,
    'agenda.firmas.config_upsert',
    'agenda_config',
    v_row.id,
    jsonb_build_object(
      'organization_id', v_target_org,
      'kind', 'firmas',
      'created', v_created,
      'enabled', v_normalized->'enabled',
      'timezone', v_normalized->'timezone',
      'min_lead_hours', v_normalized->'min_lead_hours',
      'slots_count', jsonb_array_length(v_normalized->'slots'),
      'location_ids', v_location_ids,
      'warnings_count', jsonb_array_length(v_warnings),
      'config_hash', md5(v_normalized::TEXT)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'agenda_config_id', v_row.id,
    'organization_id', v_target_org,
    'kind', 'firmas',
    'config', v_normalized,
    'created', v_created,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by,
    'warnings', v_warnings
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_agenda_config_firmas(JSONB, UUID) IS
  'Mesa admin / super_admin: upsert agenda_config firmas (modelo semanal canónico).';

REVOKE ALL ON FUNCTION public.agenda_firmas_validate_config(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agenda_firmas_config_upsert_warnings(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_agenda_config_firmas(JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_agenda_config_firmas(JSONB, UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.agenda_firmas_validate_config(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_firmas_config_upsert_warnings(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_agenda_config_firmas(JSONB, UUID) TO authenticated;
