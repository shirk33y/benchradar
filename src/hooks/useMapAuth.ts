import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabaseClient";
import { useMapUiStore } from "../store/useMapUiStore";

export function useMapAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const { setAuthMode, setMenuOpen } = useMapUiStore();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) {
          setUser(session?.user ?? null);
        }
      }
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let admin = false;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        admin = profile?.role === "admin";
      }

      if (cancelled) return;

      setIsAdmin(admin);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const openSignIn = () => {
    setAuthError(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMode("signin");
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setUser(null);
    setMenuOpen(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error || !data.user) {
      setAuthError("Invalid email or password.");
    } else {
      setUser(data.user);
      setAuthMode("closed");
    }

    setAuthLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });
    if (error) {
      setAuthError("Google sign-in failed. Please try again.");
      setAuthLoading(false);
    }
  };

  return {
    user,
    isAdmin,
    authEmail,
    authPassword,
    authError,
    authLoading,
    setAuthEmail,
    setAuthPassword,
    openSignIn,
    handleSignOut,
    handleAuthSubmit,
    handleGoogleSignIn,
  };
}
