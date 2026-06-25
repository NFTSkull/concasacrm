-- ConCasa CRM — pruebas P3J.4 RPC update_cliente_datos_revision
-- Uso: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rpc_update_cliente_datos_revision.sql

\set ON_ERROR_STOP on

DROP FUNCTION IF EXISTS public.__rpc_cdr_test_insert_exp(UUID, UUID, UUID, public.origen_mesa, BOOLEAN);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_insert_exp(UUID, UUID, UUID, public.origen_mesa, BOOLEAN, CHAR);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_insert_exp(UUID, UUID, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_assert(p_ok BOOLEAN, p_msg TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'RPC CDR TEST FAIL: %', p_msg; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
END; $$;

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_reset_auth()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END; $$;

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_insert_exp(
  p_id UUID, p_org UUID, p_asesor UUID, p_origen public.origen_mesa,
  p_submitted BOOLEAN DEFAULT true, p_nss CHAR(11) DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_nss CHAR(11);
BEGIN
  v_nss := COALESCE(p_nss, right('00000000000' || replace(p_id::text, '-', ''), 11)::char(11));
  INSERT INTO public.expedientes (
    id, organization_id, asesor_id, programa, nss, cliente_nombre,
    telefono_cliente, origen_mesa, submitted_to_mesa, fecha_envio_mesa,
    etapa_actual, subestado, ciclo_estado
  ) VALUES (
    p_id, p_org, p_asesor, 'mejoravit', v_nss, 'Fixture CDR',
    '5511111111', p_origen,
    p_submitted,
    CASE WHEN p_submitted THEN NOW() ELSE NULL END,
    1,
    CASE WHEN p_submitted THEN 'en_validacion_mesa'::public.operativo_subestado ELSE 'pendiente'::public.operativo_subestado END,
    'activo'
  )
  ON CONFLICT (id) DO UPDATE SET
    origen_mesa = EXCLUDED.origen_mesa,
    submitted_to_mesa = EXCLUDED.submitted_to_mesa,
    fecha_envio_mesa = EXCLUDED.fecha_envio_mesa,
    subestado = EXCLUDED.subestado,
    deleted_at = NULL,
    ciclo_estado = 'activo',
    updated_at = NOW();
END; $$;

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_insert_cliente(
  p_exp UUID, p_org UUID, p_estado public.cliente_datos_estado DEFAULT 'completo',
  p_comentario TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cliente_datos (
    expediente_id, organization_id, datos, estado, comentario_rechazo
  ) VALUES (
    p_exp, p_org,
    jsonb_build_object('rfc', 'XAXX010101000', 'nombreCliente', 'Fixture CDR'),
    p_estado, p_comentario
  )
  ON CONFLICT (expediente_id) DO UPDATE SET
    estado = EXCLUDED.estado,
    comentario_rechazo = EXCLUDED.comentario_rechazo,
    datos = EXCLUDED.datos,
    validated_at = NULL,
    validated_by = NULL,
    rejected_at = NULL,
    rejected_by = NULL,
    updated_at = NOW();
END; $$;

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_call(
  p_user UUID, p_exp UUID, p_estado public.cliente_datos_estado, p_comentario TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM public.__rpc_cdr_test_set_auth(p_user);
  SELECT public.update_cliente_datos_revision(p_exp, p_estado, p_comentario) INTO v_result;
  PERFORM public.__rpc_cdr_test_reset_auth();
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.__rpc_cdr_test_expect_fail(
  p_user UUID, p_exp UUID, p_estado public.cliente_datos_estado,
  p_comentario TEXT DEFAULT NULL, p_contains TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_err TEXT;
BEGIN
  PERFORM public.__rpc_cdr_test_set_auth(p_user);
  BEGIN
    PERFORM public.update_cliente_datos_revision(p_exp, p_estado, p_comentario);
    PERFORM public.__rpc_cdr_test_reset_auth();
    RETURN false;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    PERFORM public.__rpc_cdr_test_reset_auth();
    IF p_contains IS NOT NULL AND position(p_contains IN v_err) = 0 THEN
      RAISE EXCEPTION 'RPC CDR TEST FAIL: esperaba "%", obtuvo: %', p_contains, v_err;
    END IF;
    RETURN true;
  END;
END; $$;

DO $$
DECLARE
  v_org UUID := '00000000-0000-4000-8000-000000000001';
  v_asesor UUID := '00000000-0000-4000-8001-000000000001';
  v_mesa_admin UUID := '00000000-0000-4000-8003-000000000001';
  v_mesa_int UUID := '00000000-0000-4000-8004-000000000001';
  v_mesa_ext UUID := '00000000-0000-4000-8005-000000000001';
  v_super UUID := '00000000-0000-4000-8006-000000000001';

  v_exp_int UUID := '00000000-0000-4000-9031-000000000010';
  v_exp_ext UUID := '00000000-0000-4000-9031-000000000020';
  v_exp_not_sent UUID := '00000000-0000-4000-9031-000000000030';

  v_result JSONB;
  v_row public.cliente_datos%ROWTYPE;
  v_log_count INTEGER;
BEGIN
  PERFORM public.__rpc_cdr_test_insert_exp(v_exp_int, v_org, v_asesor, 'interno'::public.origen_mesa, true, '90311000001');
  PERFORM public.__rpc_cdr_test_insert_exp(v_exp_ext, v_org, v_asesor, 'externo'::public.origen_mesa, true, '90311000002');
  PERFORM public.__rpc_cdr_test_insert_exp(v_exp_not_sent, v_org, v_asesor, 'interno'::public.origen_mesa, false, '90311000003');

  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_int, v_org, 'completo');
  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_ext, v_org, 'completo');
  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_not_sent, v_org, 'completo');

  -- 1. mesa_admin valida datos internos
  v_result := public.__rpc_cdr_test_call(v_mesa_admin, v_exp_int, 'validado');
  PERFORM public.__rpc_cdr_test_assert((v_result->>'ok')::boolean = true, 'test 1: ok');
  PERFORM public.__rpc_cdr_test_assert(v_result->>'estado' = 'validado', 'test 1: estado validado');
  SELECT * INTO v_row FROM public.cliente_datos WHERE expediente_id = v_exp_int;
  PERFORM public.__rpc_cdr_test_assert(v_row.estado = 'validado', 'test 1: row validado');
  PERFORM public.__rpc_cdr_test_assert(v_row.comentario_rechazo IS NULL, 'test 1: sin comentario');

  -- 2. mesa_interno valida expediente interno
  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_int, v_org, 'completo');
  v_result := public.__rpc_cdr_test_call(v_mesa_int, v_exp_int, 'validado');
  PERFORM public.__rpc_cdr_test_assert((v_result->>'ok')::boolean = true, 'test 2: mesa_interno ok');

  -- 3. mesa_externo NO valida expediente interno
  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_int, v_org, 'completo');
  PERFORM public.__rpc_cdr_test_assert(
    public.__rpc_cdr_test_expect_fail(v_mesa_ext, v_exp_int, 'validado', NULL, 'no autorizado'),
    'test 3: mesa_externo bloqueado en interno'
  );

  -- 4. rechazar exige motivo
  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_ext, v_org, 'completo');
  PERFORM public.__rpc_cdr_test_assert(
    public.__rpc_cdr_test_expect_fail(
      v_mesa_admin, v_exp_ext, 'rechazado', NULL, 'comentario_rechazo es obligatorio'
    ),
    'test 4: rechazo sin motivo'
  );

  -- 5. rechazar guarda motivo + action_log
  v_result := public.__rpc_cdr_test_call(v_mesa_admin, v_exp_ext, 'rechazado', 'RFC no coincide');
  PERFORM public.__rpc_cdr_test_assert(v_result->>'estado' = 'rechazado', 'test 5: rechazado');
  SELECT * INTO v_row FROM public.cliente_datos WHERE expediente_id = v_exp_ext;
  PERFORM public.__rpc_cdr_test_assert(v_row.comentario_rechazo = 'RFC no coincide', 'test 5: motivo guardado');
  SELECT count(*) INTO v_log_count
  FROM public.action_log al
  WHERE al.entity_id = v_exp_ext AND al.action = 'cliente_datos.revision.update';
  PERFORM public.__rpc_cdr_test_assert(v_log_count >= 1, 'test 5: action_log');

  -- 6. validar limpia motivo
  v_result := public.__rpc_cdr_test_call(v_mesa_admin, v_exp_ext, 'validado');
  SELECT * INTO v_row FROM public.cliente_datos WHERE expediente_id = v_exp_ext;
  PERFORM public.__rpc_cdr_test_assert(v_row.estado = 'validado', 'test 6: validado');
  PERFORM public.__rpc_cdr_test_assert(v_row.comentario_rechazo IS NULL, 'test 6: motivo limpiado');

  -- 7. asesor no puede validar/rechazar
  PERFORM public.__rpc_cdr_test_insert_cliente(v_exp_int, v_org, 'completo');
  PERFORM public.__rpc_cdr_test_assert(
    public.__rpc_cdr_test_expect_fail(v_asesor, v_exp_int, 'validado', NULL, 'rol no autorizado'),
    'test 7a: asesor validar'
  );
  PERFORM public.__rpc_cdr_test_assert(
    public.__rpc_cdr_test_expect_fail(v_asesor, v_exp_int, 'rechazado', 'motivo', 'rol no autorizado'),
    'test 7b: asesor rechazar'
  );

  -- 8. submitted_to_mesa=false rechaza (super_admin ve el expediente aunque no esté enviado)
  PERFORM public.__rpc_cdr_test_assert(
    public.__rpc_cdr_test_expect_fail(
      v_super, v_exp_not_sent, 'validado', NULL, 'aún no fue enviado a Mesa'
    ),
    'test 8: no enviado a mesa'
  );

  RAISE NOTICE 'RPC update_cliente_datos_revision: 8 pruebas OK';
END;
$$;

DROP FUNCTION IF EXISTS public.__rpc_cdr_test_expect_fail(UUID, UUID, public.cliente_datos_estado, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_call(UUID, UUID, public.cliente_datos_estado, TEXT);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_insert_cliente(UUID, UUID, public.cliente_datos_estado, TEXT);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_insert_exp(UUID, UUID, UUID, public.origen_mesa, BOOLEAN, CHAR);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_reset_auth();
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_set_auth(UUID);
DROP FUNCTION IF EXISTS public.__rpc_cdr_test_assert(BOOLEAN, TEXT);
