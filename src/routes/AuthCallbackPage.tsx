import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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
