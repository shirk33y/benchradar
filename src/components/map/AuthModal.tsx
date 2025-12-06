import { type FormEvent } from "react";

import { useMapUiStore } from "../../store/useMapUiStore";

export type AuthModalProps = {
  authEmail: string;
  authPassword: string;
  authError: string | null;
  authLoading: boolean;
  setAuthEmail: (value: string) => void;
  setAuthPassword: (value: string) => void;
  handleAuthSubmit: (e: FormEvent) => void;
};

export function AuthModal({
  authEmail,
  authPassword,
  authError,
  authLoading,
  setAuthEmail,
  setAuthPassword,
  handleAuthSubmit,
}: AuthModalProps) {
  const { authMode, setAuthMode } = useMapUiStore();

  if (authMode !== "signin") return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 backdrop-blur">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 px-5 py-4 text-slate-50 shadow-[0_24px_60px_rgba(15,23,42,0.95)]">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Sign in</span>
          <button
            type="button"
            className="text-xs text-slate-400"
            onClick={() => setAuthMode("closed")}
          >
            Close
          </button>
        </div>

        <form className="space-y-3 text-sm" onSubmit={handleAuthSubmit}>
          <div className="space-y-1">
            <label className="block text-xs text-slate-400">Email</label>
            <input
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-700/80 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/80"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-slate-400">Password</label>
            <input
              type="password"
              required
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-700/80 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/80"
            />
          </div>

          {authError && <div className="text-xs text-rose-300">{authError}</div>}

          <button
            type="submit"
            className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-sky-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-900/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={authLoading}
          >
            {authLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-3 text-[11px] text-slate-400">
          Use one of the test accounts configured in Supabase Auth.
        </p>
      </div>
    </div>
  );
}
