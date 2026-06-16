-- ConCasa CRM — P2C-10 RPC save_cliente_datos (asesor guarda datos cliente)

-- =============================================================================
-- Columnas adicionales en cliente_datos (metadata teléfono, referencias, imágenes)
-- =============================================================================
ALTER TABLE public.cliente_datos
  ADD COLUMN IF NOT EXISTS telefono_normalizado TEXT NULL,
  ADD COLUMN IF NOT EXISTS referencias JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS imagenes JSONB NOT NULL DEFAULT '[]'::JSONB;

DROP INDEX IF EXISTS public.cliente_datos_telefono_org_idx;

CREATE UNIQUE INDEX IF NOT EXISTS cliente_datos_org_telefono_normalizado_unique_idx
  ON public.cliente_datos (organization_id, telefono_normalizado)
  WHERE telefono_normalizado IS NOT NULL
    AND telefono_normalizado <> '';

-- =============================================================================
-- Helpers de normalización / validación
-- =============================================================================
CREATE OR REPLACE FUNCTION public.normalize_telefono_mexico(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_input IS NULL THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_input, '[^0-9]', '', 'g');

  IF length(v_digits) = 12 AND left(v_digits, 2) = '52' THEN
    v_digits := right(v_digits, 10);
  ELSIF length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN
    v_digits := right(v_digits, 10);
  END IF;

  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_telefono_mexico_valido(p_input TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_telefono_mexico(p_input) ~ '^[0-9]{10}$';
$$;

CREATE OR REPLACE FUNCTION public.is_rfc_mexico_valido(p_rfc TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
    AND length(p_rfc) IN (12, 13);
$$;

CREATE OR REPLACE FUNCTION public.normalize_nombre_referencia(p_nombre TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(p_nombre, '')), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.referencia_telefono_raw(p_ref JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_ref->>'telefono', p_ref->>'celular');
$$;

CREATE OR REPLACE FUNCTION public.cliente_datos_telefono_ocupado_en_org(
  p_org_id UUID,
  p_exclude_expediente_id UUID,
  p_telefono_normalizado TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cliente_datos cd
    INNER JOIN public.expedientes e ON e.id = cd.expediente_id
    WHERE cd.organization_id = p_org_id
      AND cd.expediente_id <> p_exclude_expediente_id
      AND e.deleted_at IS NULL
      AND e.ciclo_estado = 'activo'
      AND (
        cd.telefono_normalizado = p_telefono_normalizado
        OR public.normalize_telefono_mexico(cd.datos->>'celular') = p_telefono_normalizado
        OR public.normalize_telefono_mexico(cd.datos->>'telefono') = p_telefono_normalizado
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(cd.referencias) = 'array' THEN cd.referencias
              ELSE '[]'::JSONB
            END
          ) AS ref(elem)
          WHERE public.normalize_telefono_mexico(public.referencia_telefono_raw(ref.elem)) = p_telefono_normalizado
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(cd.datos->'referencias') = 'array' THEN cd.datos->'referencias'
              ELSE '[]'::JSONB
            END
          ) AS ref(elem)
          WHERE public.normalize_telefono_mexico(public.referencia_telefono_raw(ref.elem)) = p_telefono_normalizado
        )
      )
  );
$$;

-- =============================================================================
-- save_cliente_datos
-- =============================================================================
CREATE OR REPLACE FUNCTION public.save_cliente_datos(
  p_expediente_id UUID,
  p_rfc TEXT,
  p_telefono TEXT,
  p_referencias JSONB DEFAULT '[]'::JSONB,
  p_imagenes JSONB DEFAULT NULL,
  p_datos JSONB DEFAULT '{}'::JSONB,
  p_estado public.cliente_datos_estado DEFAULT 'completo'
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
  v_prev public.cliente_datos%ROWTYPE;
  v_rfc TEXT;
  v_telefono_norm TEXT;
  v_referencias_norm JSONB := '[]'::JSONB;
  v_imagenes_norm JSONB;
  v_imagenes_final JSONB;
  v_datos_final JSONB;
  v_ref JSONB;
  v_img JSONB;
  v_nombre_raw TEXT;
  v_nombre_norm TEXT;
  v_ref_tel_raw TEXT;
  v_ref_tel_norm TEXT;
  v_ruta_imagen TEXT;
  v_mime TEXT;
  v_size NUMERIC;
  v_payload_phones TEXT[] := ARRAY[]::TEXT[];
  v_payload_names TEXT[] := ARRAY[]::TEXT[];
  v_updated_at TIMESTAMPTZ;
  v_referencias_count INTEGER;
  v_imagenes_count INTEGER;
  i INTEGER;
BEGIN
  v_actor_id := public.current_profile_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'save_cliente_datos: usuario no autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.app_role, p.organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles p
  WHERE p.id = v_actor_id
    AND p.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'save_cliente_datos: perfil no encontrado o inactivo'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role <> 'asesor' THEN
    RAISE EXCEPTION 'save_cliente_datos: rol no autorizado (%)', v_actor_role
      USING ERRCODE = '42501';
  END IF;

  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'save_cliente_datos: expediente_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  SELECT e.*
  INTO v_exp
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'save_cliente_datos: expediente no encontrado'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'save_cliente_datos: expediente eliminado'
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.ciclo_estado <> 'activo' THEN
    RAISE EXCEPTION 'save_cliente_datos: expediente no activo (%)', v_exp.ciclo_estado
      USING ERRCODE = '22023';
  END IF;

  IF v_exp.organization_id <> v_org_id THEN
    RAISE EXCEPTION 'save_cliente_datos: expediente de otra organización'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.asesor_id <> v_actor_id THEN
    RAISE EXCEPTION 'save_cliente_datos: solo el asesor dueño puede guardar datos del cliente'
      USING ERRCODE = '42501';
  END IF;

  IF v_exp.submitted_to_mesa THEN
    RAISE EXCEPTION 'save_cliente_datos: expediente ya enviado a Mesa'
      USING ERRCODE = '22023';
  END IF;

  -- RFC
  v_rfc := upper(btrim(COALESCE(p_rfc, '')));
  IF v_rfc = '' THEN
    RAISE EXCEPTION 'save_cliente_datos: RFC obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_rfc) NOT IN (12, 13) OR NOT public.is_rfc_mexico_valido(v_rfc) THEN
    RAISE EXCEPTION 'save_cliente_datos: RFC inválido'
      USING ERRCODE = '22023';
  END IF;

  -- Teléfono principal
  IF NULLIF(btrim(COALESCE(p_telefono, '')), '') IS NULL THEN
    RAISE EXCEPTION 'save_cliente_datos: teléfono obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_telefono_norm := public.normalize_telefono_mexico(p_telefono);
  IF v_telefono_norm IS NULL OR length(v_telefono_norm) <> 10 OR v_telefono_norm !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'save_cliente_datos: teléfono inválido'
      USING ERRCODE = '22023';
  END IF;

  v_payload_phones := array_append(v_payload_phones, v_telefono_norm);

  -- Estado (asesor solo completo o pendiente)
  IF p_estado = 'validado' THEN
    RAISE EXCEPTION 'save_cliente_datos: asesor no puede marcar validado'
      USING ERRCODE = '22023';
  END IF;

  IF p_estado NOT IN ('completo', 'pendiente') THEN
    RAISE EXCEPTION 'save_cliente_datos: estado inválido'
      USING ERRCODE = '22023';
  END IF;

  -- Referencias
  IF p_referencias IS NULL OR jsonb_typeof(p_referencias) <> 'array' THEN
    RAISE EXCEPTION 'save_cliente_datos: referencias debe ser array'
      USING ERRCODE = '22023';
  END IF;

  FOR i IN 0..jsonb_array_length(p_referencias) - 1 LOOP
    v_ref := p_referencias->i;
    v_nombre_raw := btrim(COALESCE(v_ref->>'nombre', ''));
    IF v_nombre_raw = '' THEN
      RAISE EXCEPTION 'save_cliente_datos: nombre de referencia obligatorio'
        USING ERRCODE = '22023';
    END IF;

    v_nombre_norm := public.normalize_nombre_referencia(v_nombre_raw);
    IF v_nombre_norm = ANY(v_payload_names) THEN
      RAISE EXCEPTION 'save_cliente_datos: nombre de referencia repetido'
        USING ERRCODE = '22023';
    END IF;
    v_payload_names := array_append(v_payload_names, v_nombre_norm);

    v_ref_tel_raw := public.referencia_telefono_raw(v_ref);
    IF NULLIF(btrim(COALESCE(v_ref_tel_raw, '')), '') IS NULL THEN
      RAISE EXCEPTION 'save_cliente_datos: teléfono de referencia inválido'
        USING ERRCODE = '22023';
    END IF;

    v_ref_tel_norm := public.normalize_telefono_mexico(v_ref_tel_raw);
    IF v_ref_tel_norm IS NULL OR length(v_ref_tel_norm) <> 10 OR v_ref_tel_norm !~ '^[0-9]{10}$' THEN
      RAISE EXCEPTION 'save_cliente_datos: teléfono de referencia inválido'
        USING ERRCODE = '22023';
    END IF;

    IF v_ref_tel_norm = v_telefono_norm THEN
      RAISE EXCEPTION 'save_cliente_datos: teléfono repetido en referencias'
        USING ERRCODE = '22023';
    END IF;

    IF v_ref_tel_norm = ANY(v_payload_phones) THEN
      RAISE EXCEPTION 'save_cliente_datos: teléfono de referencia repetido'
        USING ERRCODE = '22023';
    END IF;
    v_payload_phones := array_append(v_payload_phones, v_ref_tel_norm);

    v_referencias_norm := v_referencias_norm || jsonb_build_array(
      jsonb_build_object(
        'nombre', v_nombre_raw,
        'telefono', v_ref_tel_norm,
        'celular', v_ref_tel_norm
      )
    );
  END LOOP;

  -- Duplicados cross-expediente (con lock por org+teléfono)
  FOR i IN 1..array_length(v_payload_phones, 1) LOOP
    PERFORM pg_advisory_xact_lock(
      hashtext(v_org_id::text || ':' || v_payload_phones[i])
    );

    IF public.cliente_datos_telefono_ocupado_en_org(
      v_org_id,
      p_expediente_id,
      v_payload_phones[i]
    ) THEN
      IF v_payload_phones[i] = v_telefono_norm THEN
        RAISE EXCEPTION 'save_cliente_datos: teléfono repetido'
          USING ERRCODE = '22023';
      ELSE
        RAISE EXCEPTION 'save_cliente_datos: teléfono de referencia repetido'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  -- Imágenes (metadata/rutas; sin binarios)
  SELECT cd.*
  INTO v_prev
  FROM public.cliente_datos cd
  WHERE cd.expediente_id = p_expediente_id;

  IF p_imagenes IS NULL THEN
    v_imagenes_final := COALESCE(v_prev.imagenes, '[]'::JSONB);
  ELSE
    IF jsonb_typeof(p_imagenes) <> 'array' THEN
      RAISE EXCEPTION 'save_cliente_datos: imagenes debe ser array'
        USING ERRCODE = '22023';
    END IF;

    v_imagenes_norm := '[]'::JSONB;
    FOR i IN 0..jsonb_array_length(p_imagenes) - 1 LOOP
      v_img := p_imagenes->i;
      v_ruta_imagen := NULLIF(
        btrim(
          COALESCE(
            v_img->>'storage_path',
            v_img->>'url',
            v_img->>'public_url',
            ''
          )
        ),
        ''
      );

      IF v_ruta_imagen IS NULL THEN
        RAISE EXCEPTION 'save_cliente_datos: imagen sin ruta'
          USING ERRCODE = '22023';
      END IF;

      IF v_img ? 'filename' AND NULLIF(btrim(COALESCE(v_img->>'filename', '')), '') IS NULL THEN
        RAISE EXCEPTION 'save_cliente_datos: imagen sin ruta'
          USING ERRCODE = '22023';
      END IF;

      IF v_img ? 'mime_type' THEN
        v_mime := lower(btrim(COALESCE(v_img->>'mime_type', '')));
        IF v_mime NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
          RAISE EXCEPTION 'save_cliente_datos: mime_type de imagen inválido'
            USING ERRCODE = '22023';
        END IF;
      END IF;

      IF v_img ? 'size_bytes' THEN
        BEGIN
          v_size := (v_img->>'size_bytes')::NUMERIC;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE EXCEPTION 'save_cliente_datos: size_bytes inválido'
              USING ERRCODE = '22023';
        END;

        IF v_size IS NULL OR v_size <= 0 THEN
          RAISE EXCEPTION 'save_cliente_datos: size_bytes inválido'
            USING ERRCODE = '22023';
        END IF;
      END IF;

      v_imagenes_norm := v_imagenes_norm || jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'storage_path', NULLIF(btrim(COALESCE(v_img->>'storage_path', '')), ''),
            'url', NULLIF(btrim(COALESCE(v_img->>'url', '')), ''),
            'public_url', NULLIF(btrim(COALESCE(v_img->>'public_url', '')), ''),
            'filename', NULLIF(btrim(COALESCE(v_img->>'filename', '')), ''),
            'mime_type', NULLIF(lower(btrim(COALESCE(v_img->>'mime_type', ''))), ''),
            'size_bytes', CASE
              WHEN v_img ? 'size_bytes' THEN (v_img->>'size_bytes')::BIGINT
              ELSE NULL
            END,
            'tipo', NULLIF(btrim(COALESCE(v_img->>'tipo', '')), '')
          )
        )
      );
    END LOOP;

    v_imagenes_final := v_imagenes_norm;
  END IF;

  v_datos_final := COALESCE(p_datos, '{}'::JSONB)
    || jsonb_build_object(
      'rfc', v_rfc,
      'celular', v_telefono_norm,
      'telefono', v_telefono_norm,
      'referencias', v_referencias_norm
    );

  BEGIN
    INSERT INTO public.cliente_datos (
      expediente_id,
      organization_id,
      datos,
      estado,
      telefono_normalizado,
      referencias,
      imagenes,
      updated_by
    ) VALUES (
      p_expediente_id,
      v_exp.organization_id,
      v_datos_final,
      p_estado,
      v_telefono_norm,
      v_referencias_norm,
      v_imagenes_final,
      v_actor_id
    )
    ON CONFLICT (expediente_id) DO UPDATE SET
      datos = EXCLUDED.datos,
      estado = EXCLUDED.estado,
      telefono_normalizado = EXCLUDED.telefono_normalizado,
      referencias = EXCLUDED.referencias,
      imagenes = EXCLUDED.imagenes,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING updated_at INTO v_updated_at;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'save_cliente_datos: teléfono repetido'
        USING ERRCODE = '22023';
  END;

  v_referencias_count := jsonb_array_length(v_referencias_norm);
  v_imagenes_count := jsonb_array_length(v_imagenes_final);

  PERFORM public.log_action(
    v_exp.organization_id,
    v_actor_id,
    v_actor_role,
    'cliente_datos.save',
    'cliente_datos',
    p_expediente_id,
    jsonb_build_object(
      'expediente_id', p_expediente_id,
      'rfc_anterior', COALESCE(v_prev.datos->>'rfc', NULL),
      'rfc_nuevo', v_rfc,
      'telefono_anterior', COALESCE(v_prev.telefono_normalizado, public.normalize_telefono_mexico(v_prev.datos->>'celular')),
      'telefono_nuevo', v_telefono_norm,
      'estado_anterior', COALESCE(v_prev.estado::TEXT, NULL),
      'estado_nuevo', p_estado::TEXT,
      'referencias_count', v_referencias_count,
      'imagenes_count', v_imagenes_count,
      'actor_id', v_actor_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expediente_id', p_expediente_id,
    'rfc', v_rfc,
    'telefono', v_telefono_norm,
    'estado', p_estado,
    'referencias_count', v_referencias_count,
    'imagenes_count', v_imagenes_count,
    'updated_at', v_updated_at
  );
END;
$$;

COMMENT ON FUNCTION public.save_cliente_datos(
  UUID, TEXT, TEXT, JSONB, JSONB, JSONB, public.cliente_datos_estado
) IS
  'Asesor dueño guarda/actualiza cliente_datos (RFC, teléfono, referencias, imágenes metadata). No envía a Mesa ni cambia etapa.';

REVOKE ALL ON FUNCTION public.save_cliente_datos(
  UUID, TEXT, TEXT, JSONB, JSONB, JSONB, public.cliente_datos_estado
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_cliente_datos(
  UUID, TEXT, TEXT, JSONB, JSONB, JSONB, public.cliente_datos_estado
) FROM anon;

GRANT EXECUTE ON FUNCTION public.save_cliente_datos(
  UUID, TEXT, TEXT, JSONB, JSONB, JSONB, public.cliente_datos_estado
) TO authenticated;
