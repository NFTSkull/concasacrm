-- PROPOSAL ONLY: NOT APPLIED TO SUPABASE.
-- Generate an actual migration using the Supabase CLI and test outside production.
-- Raw WhatsApp webhooks may contain personal data and conversation history.
-- An approved privacy notice, access audit and retention policy are mandatory
-- before enabling this inbox with real numbers.

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_sha256 text NOT NULL UNIQUE
    CHECK (delivery_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_state text NOT NULL DEFAULT 'received'
    CHECK (processing_state IN ('received','processing','processed','deferred','failed')),
  processing_started_at timestamptz,
  processing_error_code text,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

COMMENT ON TABLE public.whatsapp_webhook_events IS
  'Authenticated Meta WhatsApp events; server-only inbox with explicit retention. Never expose to browser.';

CREATE INDEX whatsapp_webhook_events_pending_idx
  ON public.whatsapp_webhook_events(received_at)
  WHERE processing_state IN ('received', 'failed');

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_webhook_events TO service_role;
-- No anon/authenticated RLS policies. Service role only for ingestion/worker.
-- Add scheduled retry recovery, dead-letter alerts and retention cleanup before
-- production onboarding. Stuck 'processing' rows require operator recovery.
