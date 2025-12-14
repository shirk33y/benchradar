#!/usr/bin/env bash
set -euo pipefail

# Starts local Supabase if needed, optionally resets the local DB if schema isn't present,
# then runs Playwright integration tests inside the Playwright Docker image.

ensure_supabase_running() {
  if node scripts/export-local-supabase-env.mjs >/dev/null 2>&1; then
    echo "Supabase already running."
    return 0
  fi

  echo "Starting Supabase..."
  npx supabase start
}

export_local_supabase_env() {
  # shellcheck disable=SC1090
  eval "$(node scripts/export-local-supabase-env.mjs)"

  if [[ -z "${API_URL:-}" || -z "${ANON_KEY:-}" || -z "${SERVICE_ROLE_KEY:-}" || -z "${REST_URL:-}" ]]; then
    echo "Missing required env from local Supabase status." >&2
    exit 1
  fi
}

schema_looks_migrated() {
  # Detect whether schema exists by probing a table via PostgREST.
  # If the table doesn't exist or PostgREST isn't ready, we'll get a non-200.
  local url
  url="${REST_URL%/}/benches?select=id&limit=1"

  local code
  for _ in {1..15}; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      "${url}" || true)

    if [[ "$code" == "200" ]]; then
      return 0
    fi

    # 000 = curl couldn't connect yet. 502/503 can happen while services start.
    if [[ "$code" == "000" || "$code" == "502" || "$code" == "503" ]]; then
      sleep 1
      continue
    fi

    # Give a brief grace period for PostgREST/schema to settle.
    sleep 1
  done

  return 1
}

maybe_reset_db() {
  if schema_looks_migrated; then
    echo "Local DB already migrated (benches table reachable). Skipping supabase db reset."
    return 0
  fi

  echo "Local DB not migrated yet (or PostgREST not ready). Running supabase db reset..."
  npx supabase db reset --local --yes

  # After reset, refresh env vars.
  export_local_supabase_env
}

run_playwright_in_docker() {
  docker run --rm --network host \
    -e API_URL -e ANON_KEY -e SERVICE_ROLE_KEY \
    -v "$PWD":/work -w /work \
    mcr.microsoft.com/playwright:v1.57.0-jammy \
    bash -lc "npm ci && npx playwright test"
}

main() {
  ensure_supabase_running
  export_local_supabase_env
  maybe_reset_db
  run_playwright_in_docker
}

main "$@"
