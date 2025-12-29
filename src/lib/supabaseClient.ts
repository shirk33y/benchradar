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

const storage = typeof window !== "undefined" ? window.localStorage : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !import.meta.env.DEV,
    autoRefreshToken: !import.meta.env.DEV,
    detectSessionInUrl: !import.meta.env.DEV,
    storageKey: "benchradar-auth",
    storage: import.meta.env.DEV ? undefined : storage,
  },
});
