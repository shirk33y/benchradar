import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { fetchUserRole } from "../repositories/benchRepository";
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithGoogle,
  signInWithPassword,
  signOut,
} from "../repositories/authRepository";
import { useMapStore } from "../store/useMapStore";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const { setAuthMode, setMenuOpen } = useMapStore();

  useEffect(() => {
    let cancelled = false;

    getCurrentUser().then((u) => {
      if (!cancelled) {
        setUser(u);
      }
    });

    const { data: authListener } = onAuthStateChange(async (_event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
      }
    });

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
        const { role } = await fetchUserRole({ userId: user.id });
        admin = role === "admin";
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
    await signOut();
    setIsAdmin(false);
    setUser(null);
    setMenuOpen(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { data, error } = await signInWithPassword({
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
    const { error } = await signInWithGoogle({
      redirectTo: `${window.location.origin}`,
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
