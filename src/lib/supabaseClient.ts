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

if (typeof window !== "undefined") {
  try {
    // Defensive cleanup: Supabase auth uses localStorage-based locks and PKCE verifier keys.
    // In some preview/privacy contexts these can get stuck and block auth.getSession() forever.
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        const lower = k.toLowerCase();
        if (!k.startsWith("benchradar-auth")) continue;
        if (lower.includes("lock") || lower.includes("code-verifier") || lower.includes("pkce")) {
          keysToDelete.push(k);
        }
      }
      for (const k of keysToDelete) {
        window.localStorage.removeItem(k);
      }
      if (keysToDelete.length > 0) {
        // eslint-disable-next-line no-console
        console.warn("Supabase auth cleanup: removed stale keys", keysToDelete);
      }
    } catch {
      // ignore
    }

    const raw = window.localStorage.getItem("benchradar-auth");
    if (raw) {
      // eslint-disable-next-line no-console
      console.info("Supabase auth storage", { key: "benchradar-auth", bytes: raw.length });
      try {
        JSON.parse(raw);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Supabase auth storage is invalid JSON; clearing", err);
        window.localStorage.removeItem("benchradar-auth");
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Supabase auth storage check failed", err);
  }
}

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
