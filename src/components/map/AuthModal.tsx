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
  handleGoogleSignIn: () => void;
};

export function AuthModal({
  authEmail,
  authPassword,
  authError,
  authLoading,
  setAuthEmail,
  setAuthPassword,
  handleAuthSubmit,
  handleGoogleSignIn,
}: AuthModalProps) {
  const { authMode, setAuthMode } = useMapUiStore();

  if (authMode !== "signin") return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 backdrop-blur"
      onClick={() => setAuthMode("closed")}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 px-5 py-4 text-slate-50 shadow-[0_24px_60px_rgba(15,23,42,0.95)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Sign in</span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/60 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            onClick={() => setAuthMode("closed")}
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-inner shadow-slate-950/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
          >
            <img
              src="/google-logo.svg"
              alt="Google"
              className="h-4 w-4"
              draggable={false}
            />
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            <span>or</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
        </div>

        <form className="mt-3 space-y-3 text-sm" onSubmit={handleAuthSubmit}>
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

      </div>
    </div>
  );
}
