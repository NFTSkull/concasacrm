#!/usr/bin/env bash
# WhatsApp-specific SQL verification on disposable local Supabase only.
# Does not run historical document/Storage tests; it never links to hosted Supabase.
set -euo pipefail

DB_HOST="${SUPABASE_DB_HOST:-127.0.0.1}"
DB_PORT="${SUPABASE_DB_PORT:-54322}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"

for file in supabase/tests/rls_policies.sql supabase/tests/rls_whatsapp.sql; do
  echo "==> Running ${file}"
  PGPASSWORD="${DB_PASSWORD}" psql -v ON_ERROR_STOP=1 \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    -f "${file}"
done

echo "WhatsApp RLS tests: ALL PASSED"
