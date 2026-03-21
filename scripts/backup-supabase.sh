#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%F_%H-%M-%S)"
OUT_DIR="backups/${STAMP}"
mkdir -p "${OUT_DIR}"

DB_DIR="${OUT_DIR}/db"
STORAGE_DIR="${OUT_DIR}/storage"
mkdir -p "${DB_DIR}" "${STORAGE_DIR}"

SUPABASE_CLI="npx supabase"
SUPABASE_CLI_EXPERIMENTAL="npx supabase --experimental"

DB_URL="${SUPABASE_DB_URL:-}"

if [[ -n "${DB_URL}" ]]; then
  ENCODED_DB_URL="$(node -p 'encodeURIComponent(process.argv[1])' "${DB_URL}")"
  ${SUPABASE_CLI} db dump --db-url "${ENCODED_DB_URL}" -f "${DB_DIR}/schema.sql"
  ${SUPABASE_CLI} db dump --db-url "${ENCODED_DB_URL}" --data-only --use-copy -f "${DB_DIR}/data.sql"
else
  ${SUPABASE_CLI} db dump -f "${DB_DIR}/schema.sql"
  ${SUPABASE_CLI} db dump --data-only --use-copy -f "${DB_DIR}/data.sql"
fi

${SUPABASE_CLI_EXPERIMENTAL} storage cp -r "ss:///bench_photos" "${STORAGE_DIR}"

echo "Backup written to ${OUT_DIR}"
