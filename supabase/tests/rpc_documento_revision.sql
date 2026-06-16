-- ConCasa CRM — pruebas P2C-2 RPC update_documento_revision
-- Uso: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rpc_documento_revision.sql

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.__rpc_doc_test_assert(p_ok BOOLEAN, p_msg TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT p_ok THEN
    RAISE EXCEPTION 'RPC DOC TEST FAIL: %', p_msg;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.__rpc_doc_test_set_auth(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.__rpc_doc_test_reset_auth()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.__rpc_doc_test_call_as(
  p_user_id UUID,
  p_documento_id UUID,
  p_estatus public.estatus_revision,
  p_comentario_mesa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.__rpc_doc_test_set_auth(p_user_id);
  SELECT public.update_documento_revision(
    p_documento_id,
    p_estatus,
    p_comentario_mesa
  ) INTO v_result;
  PERFORM public.__rpc_doc_test_reset_auth();
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.__rpc_doc_test_call_expect_fail(
  p_user_id UUID,
  p_documento_id UUID,
  p_estatus public.estatus_revision,
  p_comentario_mesa TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.__rpc_doc_test_set_auth(p_user_id);
  BEGIN
    PERFORM public.update_documento_revision(
      p_documento_id,
      p_estatus,
      p_comentario_mesa
    );
    PERFORM public.__rpc_doc_test_reset_auth();
    RETURN false;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.__rpc_doc_test_reset_auth();
      RETURN true;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.__rpc_doc_test_sees_expediente_as(
  p_user_id UUID,
  p_expediente_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  PERFORM public.__rpc_doc_test_set_auth(p_user_id);
  SELECT EXISTS (
    SELECT 1 FROM public.expedientes e WHERE e.id = p_expediente_id
  ) INTO v_found;
  PERFORM public.__rpc_doc_test_reset_auth();
  RETURN v_found;
END;
$$;

-- UUIDs dev (ver seed.sql)
-- mesa_admin     00000000-0000-4000-8003-000000000001
-- mesa_interno   00000000-0000-4000-8004-000000000001
-- mesa_externo   00000000-0000-4000-8005-000000000001
-- asesor_interno 00000000-0000-4000-8001-000000000001
-- editor         00000000-0000-4000-8002-000000000001
-- exp_int        00000000-0000-4000-9001-000000000001
-- exp_ext        00000000-0000-4000-9001-000000000002

DO $$
DECLARE
  v_org_id UUID := '00000000-0000-4000-8000-000000000001';
  v_exp_int UUID := '00000000-0000-4000-9001-000000000001';
  v_exp_ext UUID := '00000000-0000-4000-9001-000000000002';
  v_asesor UUID := '00000000-0000-4000-8001-000000000001';
  v_editor UUID := '00000000-0000-4000-8002-000000000001';
  v_mesa_admin UUID := '00000000-0000-4000-8003-000000000001';
  v_mesa_int UUID := '00000000-0000-4000-8004-000000000001';
  v_mesa_ext UUID := '00000000-0000-4000-8005-000000000001';
  v_doc_int UUID := '00000000-0000-4000-9004-000000000010';
  v_doc_ext UUID := '00000000-0000-4000-9004-000000000020';
  v_doc_int_rech UUID := '00000000-0000-4000-9004-000000000030';
  v_doc_ext_rech UUID := '00000000-0000-4000-9004-000000000040';
  v_result JSONB;
  v_rev_before BIGINT;
  v_rev_after BIGINT;
  v_log_before BIGINT;
  v_log_after BIGINT;
BEGIN
  -- Fixtures documentos (tipos únicos para no colisionar con audit_document_history.sql)
  INSERT INTO public.expediente_documentos (
    id, organization_id, expediente_id, tipo_documento,
    storage_path, nombre_original, mime_type, size_bytes,
    estatus_revision, uploaded_by, uploaded_by_role
  ) VALUES
    (
      v_doc_int, v_org_id, v_exp_int, 'rpc_fixture_int_validar',
      'dev/rpc/int-validar.pdf', 'int-validar.pdf', 'application/pdf', 100,
      'subido', v_asesor, 'asesor'
    ),
    (
      v_doc_ext, v_org_id, v_exp_ext, 'rpc_fixture_ext_validar',
      'dev/rpc/ext-validar.pdf', 'ext-validar.pdf', 'application/pdf', 100,
      'subido', v_asesor, 'asesor'
    ),
    (
      v_doc_int_rech, v_org_id, v_exp_int, 'rpc_fixture_int_mesa',
      'dev/rpc/int-mesa.pdf', 'int-mesa.pdf', 'application/pdf', 100,
      'subido', v_asesor, 'asesor'
    ),
    (
      v_doc_ext_rech, v_org_id, v_exp_ext, 'rpc_fixture_ext_rechazo',
      'dev/rpc/ext-rechazo.pdf', 'ext-rechazo.pdf', 'application/pdf', 100,
      'subido', v_asesor, 'asesor'
    )
  ON CONFLICT (id) DO UPDATE SET
    expediente_id = EXCLUDED.expediente_id,
    estatus_revision = 'subido',
    comentario_mesa = NULL,
    deleted_at = NULL,
    updated_at = NOW();

  -- Test 11 (precheck RLS): mesa_externo no ve expediente interno
  PERFORM public.__rpc_doc_test_assert(
    NOT public.__rpc_doc_test_sees_expediente_as(v_mesa_ext, v_exp_int),
    'mesa_externo no ve expediente interno (RLS base)'
  );
  PERFORM public.__rpc_doc_test_assert(
    public.__rpc_doc_test_sees_expediente_as(v_mesa_int, v_exp_int),
    'mesa_interno ve expediente interno'
  );

  -- Test 1: mesa_admin valida documento enviado interno
  SELECT count(*) INTO v_rev_before
  FROM public.documento_revisiones WHERE documento_id = v_doc_int;
  SELECT count(*) INTO v_log_before
  FROM public.action_log
  WHERE entity_type = 'expediente_documento' AND entity_id = v_doc_int;

  v_result := public.__rpc_doc_test_call_as(v_mesa_admin, v_doc_int, 'validado');

  PERFORM public.__rpc_doc_test_assert(
    (v_result->>'ok')::boolean = true,
    'mesa_admin: ok=true'
  );
  PERFORM public.__rpc_doc_test_assert(
    v_result->>'estatus_revision' = 'validado',
    'mesa_admin: estatus validado'
  );

  SELECT count(*) INTO v_rev_after
  FROM public.documento_revisiones WHERE documento_id = v_doc_int;
  SELECT count(*) INTO v_log_after
  FROM public.action_log
  WHERE entity_type = 'expediente_documento'
    AND entity_id = v_doc_int
    AND action = 'documento.revision.update';

  PERFORM public.__rpc_doc_test_assert(
    v_rev_after = v_rev_before + 1,
    'mesa_admin: crea fila documento_revisiones'
  );
  PERFORM public.__rpc_doc_test_assert(
    v_log_after = v_log_before + 1,
    'mesa_admin: crea fila action_log'
  );

  -- Test 2: mesa_interno valida documento interno (otro doc)
  v_result := public.__rpc_doc_test_call_as(v_mesa_int, v_doc_int_rech, 'validado');
  PERFORM public.__rpc_doc_test_assert(
    (v_result->>'ok')::boolean = true,
    'mesa_interno valida documento interno'
  );

  -- Test 3: mesa_externo NO puede validar documento interno
  PERFORM public.__rpc_doc_test_assert(
    public.__rpc_doc_test_call_expect_fail(v_mesa_ext, v_doc_int, 'validado'),
    'mesa_externo NO valida documento expediente interno'
  );

  -- Test 4: mesa_externo valida documento externo
  v_result := public.__rpc_doc_test_call_as(v_mesa_ext, v_doc_ext, 'validado');
  PERFORM public.__rpc_doc_test_assert(
    (v_result->>'ok')::boolean = true,
    'mesa_externo valida documento expediente externo'
  );

  -- Test 5: asesor NO puede validar
  PERFORM public.__rpc_doc_test_assert(
    public.__rpc_doc_test_call_expect_fail(v_asesor, v_doc_ext, 'validado'),
    'asesor NO puede validar documento'
  );

  -- Test 6: editor NO puede validar
  PERFORM public.__rpc_doc_test_assert(
    public.__rpc_doc_test_call_expect_fail(v_editor, v_doc_ext, 'validado'),
    'editor NO puede validar documento'
  );

  -- Test 7: rechazo sin comentario falla
  PERFORM public.__rpc_doc_test_assert(
    public.__rpc_doc_test_call_expect_fail(v_mesa_admin, v_doc_ext_rech, 'rechazado', NULL),
    'rechazo sin comentario falla'
  );
  PERFORM public.__rpc_doc_test_assert(
    public.__rpc_doc_test_call_expect_fail(v_mesa_admin, v_doc_ext_rech, 'rechazado', '   '),
    'rechazo con comentario vacío falla'
  );

  -- Test 8: rechazo con comentario pasa
  SELECT count(*) INTO v_rev_before
  FROM public.documento_revisiones WHERE documento_id = v_doc_ext_rech;
  SELECT count(*) INTO v_log_before
  FROM public.action_log
  WHERE entity_type = 'expediente_documento' AND entity_id = v_doc_ext_rech;

  v_result := public.__rpc_doc_test_call_as(
    v_mesa_ext,
    v_doc_ext_rech,
    'rechazado',
    'Documento ilegible'
  );

  PERFORM public.__rpc_doc_test_assert(
    (v_result->>'ok')::boolean = true,
    'rechazo con comentario: ok=true'
  );
  PERFORM public.__rpc_doc_test_assert(
    v_result->>'comentario_mesa' = 'Documento ilegible',
    'rechazo con comentario guardado'
  );

  SELECT count(*) INTO v_rev_after
  FROM public.documento_revisiones WHERE documento_id = v_doc_ext_rech;
  SELECT count(*) INTO v_log_after
  FROM public.action_log
  WHERE entity_type = 'expediente_documento'
    AND entity_id = v_doc_ext_rech
    AND action = 'documento.revision.update';

  PERFORM public.__rpc_doc_test_assert(
    v_rev_after = v_rev_before + 1,
    'rechazo: crea fila documento_revisiones'
  );
  PERFORM public.__rpc_doc_test_assert(
    v_log_after = v_log_before + 1,
    'rechazo: crea fila action_log'
  );

  PERFORM public.__rpc_doc_test_assert(
    EXISTS (
      SELECT 1
      FROM public.action_log al
      WHERE al.entity_id = v_doc_ext_rech
        AND al.action = 'documento.revision.update'
        AND al.payload->>'estatus_nuevo' = 'rechazado'
        AND al.payload->>'tipo_documento' = 'rpc_fixture_ext_rechazo'
    ),
    'action_log payload incluye metadatos de revisión'
  );

  RAISE NOTICE 'RPC documento revision tests: ALL PASSED';
END;
$$;

DROP FUNCTION IF EXISTS public.__rpc_doc_test_assert(BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.__rpc_doc_test_set_auth(UUID);
DROP FUNCTION IF EXISTS public.__rpc_doc_test_reset_auth();
DROP FUNCTION IF EXISTS public.__rpc_doc_test_call_as(UUID, UUID, public.estatus_revision, TEXT);
DROP FUNCTION IF EXISTS public.__rpc_doc_test_call_expect_fail(UUID, UUID, public.estatus_revision, TEXT);
DROP FUNCTION IF EXISTS public.__rpc_doc_test_sees_expediente_as(UUID, UUID);
