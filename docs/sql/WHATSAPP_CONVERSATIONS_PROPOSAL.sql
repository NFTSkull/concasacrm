-- PROPOSAL ONLY — no production DB changes have been applied.
-- The migration file MUST be generated via Supabase CLI and tested on a separate DB.
-- Each adviser owns a distinct WhatsApp Business phone_number_id.
-- Personal WhatsApp contacts can be captured by Coexistence: onboard only with
-- explicit informed consent, documented purpose and approved retention policy.

CREATE TABLE public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  advisor_id uuid NOT NULL REFERENCES public.profiles(id),
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
    connection_state <> 'active'
    OR (coexistence_confirmed = true AND consent_received_at IS NOT NULL)
  )
);

CREATE INDEX whatsapp_connections_advisor_idx
  ON public.whatsapp_connections (advisor_id, connection_state);

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE RESTRICT,
  contact_wa_id text NOT NULL CHECK (length(contact_wa_id) BETWEEN 1 AND 128),
  contact_display_name text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, contact_wa_id)
);

CREATE INDEX whatsapp_conversations_recent_idx
  ON public.whatsapp_conversations (connection_id, last_message_at DESC NULLS LAST);

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
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, meta_message_id)
);

CREATE INDEX whatsapp_messages_thread_idx
  ON public.whatsapp_messages (conversation_id, sent_at DESC, id);

COMMENT ON TABLE public.whatsapp_connections IS
  'Advisor-owned WhatsApp Business Coexistence identities; no Meta tokens stored here.';
COMMENT ON TABLE public.whatsapp_conversations IS
  'Private WhatsApp conversations. Access limited to the owner of the connection.';
COMMENT ON TABLE public.whatsapp_messages IS
  'Messages from Meta webhook projection. No message write permissions for browsers.';

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_connections FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_messages FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_connections TO authenticated;
GRANT SELECT ON public.whatsapp_conversations TO authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_connections TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO service_role;

-- The identity of the signed-in account is taken exclusively from Supabase
-- auth, not from advisor_id or a role supplied by the browser.
CREATE POLICY whatsapp_connections_owner_read
  ON public.whatsapp_connections FOR SELECT TO authenticated
  USING (
    advisor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.active = true
        AND p.organization_id = whatsapp_connections.organization_id
    )
  );

CREATE POLICY whatsapp_conversations_owner_read
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_connections c
      WHERE c.id = whatsapp_conversations.connection_id
        AND c.advisor_id = (SELECT auth.uid())
        AND c.connection_state = 'active'
        AND c.coexistence_confirmed = true
        AND c.consent_received_at IS NOT NULL
    )
  );

CREATE POLICY whatsapp_messages_owner_read
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.whatsapp_conversations conv
      JOIN public.whatsapp_connections c ON c.id = conv.connection_id
      WHERE conv.id = whatsapp_messages.conversation_id
        AND c.advisor_id = (SELECT auth.uid())
        AND c.connection_state = 'active'
        AND c.coexistence_confirmed = true
        AND c.consent_received_at IS NOT NULL
    )
  );

-- NOT included intentionally: browser INSERT/UPDATE/DELETE, broadcast,
-- admin blanket read, token storage, contact export, historic sync import,
-- autoconnecting numbers, and Meta Cloud API sending.
-- Privileged ingestion requires a separately-reviewed server worker.
