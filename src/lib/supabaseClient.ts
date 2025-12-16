import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:54321";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "test-anon-key";

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
