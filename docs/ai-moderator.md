# ai-moderator

## Goal
- Provide a **background worker** that auto-approves / auto-rejects bench submissions and edits.
- Runs on any machine (CI, VPS, laptop) using a local `.env` to connect to Supabase.
- Uses AI vision to check each submitted photo and decides **"bench present"** when **probability > 0.5**.

## Why this exists
- Current model (`public.benches.status`) mixes **submission state** with the **canonical bench record**.
- Direct updates to `benches` are risky (no audit trail / easy to overwrite mistakes).
- We want **Wikipedia-like history** so every change is reviewable, reversible, and attributable.

## High-level architecture
- **Frontend** creates a *proposed change* as an immutable **bench version**.
- DB enqueues a **moderation job** for that version.
- **ai-moderator worker**:
  - claims one job at a time (safe with multiple workers)
  - loads the bench version + photos
  - runs AI inference per photo
  - writes a moderation decision (audit)
  - marks version approved/rejected
  - if approved: applies the version to the canonical `benches` record

## Data model (proposed)

### Canonical benches
- `public.benches` is the **published/canonical** entity shown to normal users.
- Recommended invariant:
  - `benches` contains **approved** state only
  - all pending/rejected states live in `bench_versions`

### Version history
**Table: `public.bench_versions`** (immutable)
- `id uuid pk`
- `bench_id uuid null` (null for new submissions not yet published)
- `created_by uuid null` (auth user)
- `source text` (`user|admin|ai`)
- `status text` (`pending|approved|rejected|superseded`)
- `data jsonb` (lat/lng/description/title/etc)
- `created_at timestamptz`

**Table: `public.bench_version_photos`**
- `id uuid pk`
- `bench_version_id uuid fk -> bench_versions(id)`
- `url text`
- `is_main boolean`
- `created_at timestamptz`

**Table: `public.bench_moderation_decisions`** (append-only audit)
- `id uuid pk`
- `bench_version_id uuid fk`
- `decider_type text` (`human|ai`)
- `decided_by uuid null` (human user id; null for AI)
- `decision text` (`approved|rejected`)
- `bench_probability float8 null` (AI score; recommended: store max across photos)
- `model text null`
- `reason text null`
- `created_at timestamptz`

### Moderation job queue
**Table: `public.moderation_jobs`**
- `id uuid pk`
- `job_type text` (e.g. `bench_version_moderation`)
- `bench_version_id uuid not null`
- `status text` (`queued|processing|succeeded|failed|dead`)
- `attempts int default 0`
- `max_attempts int default 5`
- `run_after timestamptz default now()` (retry scheduling)
- `locked_at timestamptz null`
- `locked_by text null` (worker id)
- `last_error text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Index recommendation:
- `(status, run_after, created_at)`

## Queue primitives (proposed RPC)
To avoid race conditions and allow N workers:

**RPC: `public.claim_next_moderation_job(worker_id text)`**
- Select 1 job:
  - `status = 'queued'`
  - `run_after <= now()`
  - order by `created_at`
  - `FOR UPDATE SKIP LOCKED`
- Update it to `processing`, set `locked_at/locked_by`, increment `attempts`.
- Return the claimed row.

**RPC: `public.complete_moderation_job(job_id uuid, success boolean, error_message text)`**
- `success=true` => `status='succeeded'`
- `success=false` =>
  - if `attempts < max_attempts`: `status='queued'` + exponential backoff via `run_after`
  - else `status='dead'`

## Worker behavior
### Inputs
- Supabase connection:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never shipped to frontend)
- Worker identity:
  - `AI_MODERATOR_WORKER_ID` (hostname, container id, etc)
- AI provider secrets as needed (example):
  - `OPENAI_API_KEY`

### Decision rule (v0)
For a given `bench_version_id`:
- Download/inspect each photo URL in `bench_version_photos`.
- For each photo compute `p(bench_present)`.
- Decision:
  - approve if `max(p) > 0.5`
  - reject otherwise
- Record:
  - write to `bench_moderation_decisions` with `decider_type='ai'`
  - set `bench_versions.status` accordingly
  - if approved: apply `bench_versions.data` + photos to canonical `benches`

## Roles / security
- Human roles live in `public.profiles.role` (currently `user|admin`).
- Add `moderator` role for human accounts (recommended) with limited powers:
  - read pending versions
  - write `bench_moderation_decisions` as `human`
  - approve/reject versions
- Worker authentication:
  - use **service role key** to bypass RLS for queue + applying approved versions.

## Integration points (current code)
- Frontend currently:
  - creates `public.benches` with `status='pending'`
  - directly updates `benches` during edits
- With versioning enabled:
  - create/edit should create a new `bench_versions` row and enqueue `moderation_jobs`
  - admin UI should moderate **versions**, not mutate canonical benches directly
