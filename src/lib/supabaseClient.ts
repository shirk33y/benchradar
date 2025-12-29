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

const memoryStorage = new Map<string, string>();

const storage =
  typeof window !== "undefined"
    ? {
        getItem: (key: string) => {
          try {
            const v = window.localStorage.getItem(key);
            if (v !== null) return v;
          } catch {
            // ignore
          }
          return memoryStorage.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          memoryStorage.set(key, value);
          try {
            window.localStorage.setItem(key, value);
          } catch {
            // ignore
          }
        },
        removeItem: (key: string) => {
          memoryStorage.delete(key);
          try {
            window.localStorage.removeItem(key);
          } catch {
            // ignore
          }
        },
      }
    : undefined;

async function tracedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  // eslint-disable-next-line no-console
  console.info("Supabase fetch", {
    method: init?.method ?? "GET",
    url,
  });

  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Supabase fetch failed", { url }, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: tracedFetch,
  },
  auth: {
    flowType: "pkce",
    persistSession: !import.meta.env.DEV,
    autoRefreshToken: !import.meta.env.DEV,
    detectSessionInUrl: !import.meta.env.DEV,
    storageKey: "benchradar-auth",
    storage: import.meta.env.DEV ? undefined : storage,
  },
});
