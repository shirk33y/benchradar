#!/usr/bin/env bash
set -euo pipefail

# Starts local Supabase if needed, optionally resets the local DB if schema isn't present,
# then runs Playwright E2E tests inside the Playwright Docker image.

export DOCKER_HIDE_LEGACY_PROGRESS=1
export COMPOSE_PROGRESS=quiet
export NPM_CONFIG_FUND=false
export NPM_CONFIG_AUDIT=false
export NPM_CONFIG_UPDATE_NOTIFIER=false

supabase_cmd() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  else
    npx supabase "$@"
  fi
}

ensure_supabase_running() {
  if node scripts/export-local-supabase-env.mjs >/dev/null 2>&1; then
    echo "Supabase already running."
    return 0
  fi

  echo "Starting Supabase..."

  # Optional for CI: e.g. SUPABASE_START_ARGS="--exclude studio,edge-runtime"
  # shellcheck disable=SC2206
  local start_args=(${SUPABASE_START_ARGS:-})
  supabase_cmd start "${start_args[@]}"
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

    if [[ "$code" == "000" || "$code" == "502" || "$code" == "503" ]]; then
      sleep 1
      continue
    fi

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
  supabase_cmd db reset --local --yes

  export_local_supabase_env
}

run_playwright_in_docker() {
  if ! docker image inspect mcr.microsoft.com/playwright:v1.57.0-jammy >/dev/null 2>&1; then
    docker pull -q mcr.microsoft.com/playwright:v1.57.0-jammy >/dev/null 2>&1 || true
  fi

  docker run --rm --network host --pull=never \
    -e API_URL -e ANON_KEY -e SERVICE_ROLE_KEY \
    -e NPM_CONFIG_FUND=false -e NPM_CONFIG_AUDIT=false -e NPM_CONFIG_UPDATE_NOTIFIER=false \
    -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    -v "$PWD":/work -w /work \
    mcr.microsoft.com/playwright:v1.57.0-jammy \
    bash -lc "npm ci --silent --no-fund --no-audit && npx playwright test"
}

main() {
  ensure_supabase_running
  export_local_supabase_env
  maybe_reset_db
  run_playwright_in_docker
}

main "$@"
