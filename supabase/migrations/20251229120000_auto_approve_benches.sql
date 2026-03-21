SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Needed for async HTTP from Postgres to Edge Functions
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- Simple key/value store for runtime URLs/secrets used by triggers.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.set_app_setting(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.app_settings(key, value)
  values (p_key, p_value)
  on conflict (key) do update
    set value = excluded.value,
        updated_at = timezone('utc'::text, now());
end;
$$;

-- Trigger function: on any new bench photo row, enqueue an auto-approve check.
CREATE OR REPLACE FUNCTION public.enqueue_auto_approve_bench()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
declare
  fn_url text;
  fn_secret text;
  headers jsonb;
  body jsonb;
begin
  select value into fn_url from public.app_settings where key = 'AUTOAPPROVE_FUNCTION_URL';
  select value into fn_secret from public.app_settings where key = 'AUTOAPPROVE_TRIGGER_SECRET';

  if fn_url is null or length(fn_url) = 0 then
    return new;
  end if;

  headers := jsonb_build_object('Content-Type', 'application/json');
  if fn_secret is not null and length(fn_secret) > 0 then
    headers := headers || jsonb_build_object('x-autoapprove-secret', fn_secret);
  end if;

  body := jsonb_build_object('bench_id', new.bench_id);

  -- Fire-and-forget. We don't care about the response here.
  perform net.http_post(
    url := fn_url,
    headers := headers,
    body := body
  );

  return new;
end;
$$;

DROP TRIGGER IF EXISTS bench_photos_auto_approve_trigger ON public.bench_photos;
CREATE TRIGGER bench_photos_auto_approve_trigger
AFTER INSERT ON public.bench_photos
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_auto_approve_bench();
