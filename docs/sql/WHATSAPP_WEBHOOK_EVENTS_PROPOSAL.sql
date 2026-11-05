-- PROPOSAL ONLY: NOT APPLIED TO SUPABASE.
-- When approved, create a migration via Supabase CLI: supabase migration new whatsapp_webhook_events
-- Then copy this SQL into the generated migration and test on a non-production DB.
-- Raw WhatsApp messages contain PII. Apply a retention policy before live use.
create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_sha256 text not null unique
    check (delivery_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now(),
  processing_state text not null default 'received'
    check (processing_state in ('received', 'processing', 'processed', 'failed')),
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0)
);
comment on table public.whatsapp_webhook_events is
'Raw authenticated Meta WhatsApp webhook envelopes; server-only inbox; not exposed to advisors. Requires approved privacy and retention controls.';
create index if not exists whatsapp_webhook_events_pending_idx
  on public.whatsapp_webhook_events(received_at)
  where processing_state in ('received','failed');
alter table public.whatsapp_webhook_events enable row level security;
revoke all on public.whatsapp_webhook_events from anon, authenticated;
grant select, insert, update on public.whatsapp_webhook_events to service_role;
-- No policies for anon/authenticated: deny by default.
-- Do not attach UI or send functionality until individual phones are mapped to authorized advisors.
