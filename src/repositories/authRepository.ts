import { supabase } from "../lib/supabaseClient";

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export function onAuthStateChange(
  handler: Parameters<typeof supabase.auth.onAuthStateChange>[0]
) {
  return supabase.auth.onAuthStateChange(handler);
}

export async function signInWithPassword(args: { email: string; password: string }) {
  const { email, password } = args;
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(args: { redirectTo: string }) {
  const { redirectTo } = args;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
