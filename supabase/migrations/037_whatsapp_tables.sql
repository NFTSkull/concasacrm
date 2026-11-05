-- WhatsApp test sender and coexistence draft — NOT applied to production.
-- Created from Claude Chrome's 037 proposal; isolated from existing CRM tables.

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_sha256 text NOT NULL UNIQUE CHECK (delivery_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_state text NOT NULL DEFAULT 'received'
    CHECK (processing_state IN ('received','processing','processed','deferred','failed')),
  processing_started_at timestamptz,
  processing_error_code text,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX whatsapp_webhook_events_pending_idx ON public.whatsapp_webhook_events(received_at)
  WHERE processing_state IN ('received','failed');

CREATE TABLE public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  advisor_id uuid NOT NULL REFERENCES public.profiles(id),
  connection_type text NOT NULL CHECK (connection_type IN ('meta_test','coexistence')),
  waba_id text NOT NULL CHECK (length(waba_id) BETWEEN 1 AND 128),
  phone_number_id text NOT NULL UNIQUE CHECK (length(phone_number_id) BETWEEN 1 AND 128),
  display_phone_number text,
  connection_state text NOT NULL DEFAULT 'pending'
    CHECK (connection_state IN ('pending','active','disconnected','error')),
  coexistence_confirmed boolean NOT NULL DEFAULT false,
  consent_received_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT active_coexistence_requires_consent CHECK (
    connection_state <> 'active' OR connection_type = 'meta_test'
    OR (coexistence_confirmed = true AND consent_received_at IS NOT NULL)
  ),
  CONSTRAINT meta_test_cannot_claim_coexistence CHECK (
    connection_type <> 'meta_test' OR coexistence_confirmed = false
  )
);
CREATE INDEX whatsapp_connections_advisor_idx ON public.whatsapp_connections(advisor_id, connection_state);

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE RESTRICT,
  contact_wa_id text NOT NULL CHECK (length(contact_wa_id) BETWEEN 1 AND 128),
  contact_display_name text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id,contact_wa_id)
);
CREATE INDEX whatsapp_conversations_recent_idx
  ON public.whatsapp_conversations(connection_id,last_message_at DESC NULLS LAST);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE RESTRICT,
  meta_message_id text NOT NULL CHECK (length(meta_message_id) BETWEEN 1 AND 512),
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  source text NOT NULL CHECK (source IN ('cloud_api','business_app','history')),
  message_type text NOT NULL,
  text_body text,
  sent_at timestamptz NOT NULL,
  delivery_status text NOT NULL DEFAULT 'unknown'
    CHECK (delivery_status IN ('unknown','sent','delivered','read','failed')),
  sent_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id,meta_message_id),
  CONSTRAINT sent_by_only_on_outgoing_cloud_api CHECK (
    sent_by_profile_id IS NULL OR (direction = 'outgoing' AND source = 'cloud_api')
  )
);
CREATE INDEX whatsapp_messages_thread_idx
  ON public.whatsapp_messages(conversation_id,sent_at DESC,id);

CREATE TABLE public.whatsapp_verified_test_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  wa_id text NOT NULL CHECK (length(wa_id) BETWEEN 1 AND 128),
  added_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  verified_in_meta_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id,wa_id)
);
COMMENT ON TABLE public.whatsapp_webhook_events IS 'Private signed Meta webhook envelopes; server-only';
COMMENT ON TABLE public.whatsapp_connections IS 'Advisor-owned Meta test or WhatsApp Business Coexistence number; tokens must never be stored here';
COMMENT ON TABLE public.whatsapp_verified_test_recipients IS 'Server-only allowlist; add only after verifying the recipient in Meta';

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_verified_test_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_connections FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_messages FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_verified_test_recipients FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_connections TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_verified_test_recipients TO service_role;
GRANT SELECT ON public.whatsapp_connections, public.whatsapp_conversations, public.whatsapp_messages TO authenticated;

CREATE POLICY whatsapp_connections_owner_read ON public.whatsapp_connections
  FOR SELECT TO authenticated USING (
    advisor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.active = true
        AND p.organization_id = whatsapp_connections.organization_id
    )
  );

CREATE POLICY whatsapp_conversations_owner_read ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_connections c
      WHERE c.id = whatsapp_conversations.connection_id
        AND c.advisor_id = (SELECT auth.uid())
        AND c.connection_state = 'active'
        AND (
          c.connection_type = 'meta_test'
          OR (c.coexistence_confirmed = true AND c.consent_received_at IS NOT NULL)
        )
    )
  );

CREATE POLICY whatsapp_messages_owner_read ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_conversations conv
      JOIN public.whatsapp_connections c ON c.id = conv.connection_id
      WHERE conv.id = whatsapp_messages.conversation_id
        AND c.advisor_id = (SELECT auth.uid())
        AND c.connection_state = 'active'
        AND (
          c.connection_type = 'meta_test'
          OR (c.coexistence_confirmed = true AND c.consent_received_at IS NOT NULL)
        )
    )
  );

-- No browser INSERT/UPDATE/DELETE; no automatic numbers, sends, or admin-wide reads.
-- Full RLS tests, privacy/retention and backup review mandatory before production.
