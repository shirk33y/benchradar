import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) {
          // eslint-disable-next-line no-console
          console.warn("auth callback: missing code param");
          return;
        }

        const hasVerifier = (() => {
          try {
            for (let i = 0; i < window.localStorage.length; i += 1) {
              const k = window.localStorage.key(i);
              if (!k) continue;
              const lower = k.toLowerCase();
              if (!k.startsWith("benchradar-auth")) continue;
              if (lower.includes("code-verifier") || lower.includes("pkce")) return true;
            }
          } catch {
            return false;
          }
          return false;
        })();

        if (!hasVerifier) {
          // eslint-disable-next-line no-console
          console.warn("auth callback: missing PKCE verifier; user must retry login");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          // eslint-disable-next-line no-console
          console.error("auth callback exchange failed", error);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("auth callback exception", err);
      } finally {
        if (!cancelled) {
          navigate("/", { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
