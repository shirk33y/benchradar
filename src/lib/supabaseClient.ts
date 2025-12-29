import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:54321")
  : (import.meta.env.VITE_SUPABASE_URL as string | undefined);

const supabaseAnonKey = import.meta.env.DEV
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "test-anon-key")
  : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!import.meta.env.DEV) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (required for production/preview builds)."
    );
  }
}

// eslint-disable-next-line no-console
console.info("Supabase init", {
  url: supabaseUrl,
  mode: import.meta.env.DEV ? "dev" : "prod",
});

const storage = typeof window !== "undefined" ? window.localStorage : undefined;

async function tracedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const startMs = Date.now();
  // eslint-disable-next-line no-console
  console.info("Supabase fetch", {
    method: init?.method ?? "GET",
    url,
  });

  const controller = new AbortController();
  const timeoutMs = 15000;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = init?.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const durationMs = Date.now() - startMs;
    // eslint-disable-next-line no-console
    console.info("Supabase fetch done", {
      method: init?.method ?? "GET",
      url,
      status: res.status,
      ok: res.ok,
      durationMs,
    });
    return res;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    // eslint-disable-next-line no-console
    console.error(
      timedOut ? "Supabase fetch timed out" : "Supabase fetch failed",
      { url, durationMs },
      err
    );
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal && !externalSignal.aborted) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: tracedFetch,
  },
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "benchradar-auth",
    storage,
  },
});
