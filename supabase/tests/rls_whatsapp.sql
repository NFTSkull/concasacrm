-- ConCasa CRM — WhatsApp RLS tests (LOCAL DB ONLY, after db reset + seed)
-- NEVER execute this test on production. Uses fixed synthetic UUIDs.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.__rls_wa_assert(p_ok boolean, p_msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'WhatsApp RLS FAIL: %', p_msg; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.__rls_wa_count_as(p_user_id uuid, p_table text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_count bigint;
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',p_user_id::text,true);
  EXECUTE format('SELECT count(*) FROM public.%I',p_table) INTO v_count;
  PERFORM set_config('role','postgres',true);
  PERFORM set_config('request.jwt.claim.sub','',true);
  RETURN v_count;
END;
$$;

-- Two adviser fixtures, same organization, different Meta test connections.
INSERT INTO public.whatsapp_connections
 (id,organization_id,advisor_id,connection_type,waba_id,phone_number_id,connection_state)
VALUES
 ('00000000-0000-4000-8701-000000000001','00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8001-000000000001','meta_test','waba-dev','phone-dev-a','active'),
 ('00000000-0000-4000-8701-000000000002','00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8001-000000000002','meta_test','waba-dev','phone-dev-b','active');

INSERT INTO public.whatsapp_conversations (id,connection_id,contact_wa_id)
VALUES
 ('00000000-0000-4000-8702-000000000001','00000000-0000-4000-8701-000000000001','5218100000001'),
 ('00000000-0000-4000-8702-000000000002','00000000-0000-4000-8701-000000000002','5218100000002');

INSERT INTO public.whatsapp_messages
 (id,conversation_id,meta_message_id,direction,source,message_type,text_body,sent_at)
VALUES
 ('00000000-0000-4000-8703-000000000001','00000000-0000-4000-8702-000000000001',
  'wamid.local.a','incoming','cloud_api','text','hola a',now()),
 ('00000000-0000-4000-8703-000000000002','00000000-0000-4000-8702-000000000002',
  'wamid.local.b','incoming','cloud_api','text','hola b',now());

DO $$
DECLARE
  a uuid := '00000000-0000-4000-8001-000000000001';
  b uuid := '00000000-0000-4000-8001-000000000002';
  editor uuid := '00000000-0000-4000-8002-000000000001';
BEGIN
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(a,'whatsapp_connections')=1,'advisor A connection');
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(b,'whatsapp_connections')=1,'advisor B connection');
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(a,'whatsapp_conversations')=1,'advisor A conversation');
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(b,'whatsapp_conversations')=1,'advisor B conversation');
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(a,'whatsapp_messages')=1,'advisor A message');
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(b,'whatsapp_messages')=1,'advisor B message');
  PERFORM public.__rls_wa_assert(public.__rls_wa_count_as(editor,'whatsapp_messages')=0,'editor cannot see private messages');
  -- A user's old phone must become invisible when their advisor role is revoked.
  UPDATE public.profiles SET app_role='editor'
    WHERE id='00000000-0000-4000-8001-000000000001';
  PERFORM public.__rls_wa_assert(
    public.__rls_wa_count_as(a,'whatsapp_connections')=0,
    'revoked advisor cannot view linked phone');
  PERFORM public.__rls_wa_assert(
    public.__rls_wa_count_as(a,'whatsapp_conversations')=0,
    'revoked advisor cannot view conversations');
  PERFORM public.__rls_wa_assert(
    public.__rls_wa_count_as(a,'whatsapp_messages')=0,
    'revoked advisor cannot view messages');
  UPDATE public.profiles SET app_role='asesor'
    WHERE id='00000000-0000-4000-8001-000000000001';

  BEGIN
    UPDATE public.whatsapp_connections SET coexistence_confirmed=true
      WHERE id='00000000-0000-4000-8701-000000000001';
    RAISE EXCEPTION 'meta_test CHECK did not reject false coexistence claim';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE 'WhatsApp RLS checks passed';
END;
$$;

DELETE FROM public.whatsapp_messages WHERE id IN (
 '00000000-0000-4000-8703-000000000001','00000000-0000-4000-8703-000000000002');
DELETE FROM public.whatsapp_conversations WHERE id IN (
 '00000000-0000-4000-8702-000000000001','00000000-0000-4000-8702-000000000002');
DELETE FROM public.whatsapp_connections WHERE id IN (
 '00000000-0000-4000-8701-000000000001','00000000-0000-4000-8701-000000000002');
DROP FUNCTION IF EXISTS public.__rls_wa_count_as(uuid,text);
DROP FUNCTION IF EXISTS public.__rls_wa_assert(boolean,text);
