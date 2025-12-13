import { useMapUiStore } from "../../store/useMapUiStore";

export type HamburgerMenuProps = {
  isSignedIn: boolean;
  isAdmin: boolean;
  userEmail?: string | null;
  openSignIn: () => void;
  handleSignOut: () => void;
  onGoToAdmin: () => void;
};

export function HamburgerMenu({
  isSignedIn,
  isAdmin,
  userEmail,
  openSignIn,
  handleSignOut,
  onGoToAdmin,
}: HamburgerMenuProps) {
  const { isMenuOpen, toggleMenu, setMenuOpen } = useMapUiStore();

  return (
    <>
      <button
        type="button"
        className="absolute bottom-8 left-6 z-[1000] inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-800/80 bg-slate-900/90 text-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.65)] active:scale-95"
        aria-label="Open menu"
        onClick={toggleMenu}
      >
        <span className="text-2xl leading-none">☰</span>
      </button>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[960] bg-slate-950/25 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />

          <div className="absolute bottom-24 left-6 w-64 rounded-3xl border border-slate-800/70 bg-slate-900/95 px-3 py-3 text-slate-50 shadow-[0_20px_45px_rgba(15,23,42,0.95)]">
            <div className="mb-2 text-xs text-slate-400 text-center">
              {isSignedIn ? (
                <span className="font-mono text-[11px] text-slate-200">
                  {userEmail ?? "Signed in"}
                </span>
              ) : (
                <span>Not signed in</span>
              )}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              {!isSignedIn && (
                <button
                  type="button"
                  className="flex items-center justify-between rounded-2xl bg-sky-500/90 px-3 py-2 font-medium text-slate-950 active:scale-[0.98]"
                  onClick={openSignIn}
                >
                  <span>Sign in</span>
                </button>
              )}

              {isSignedIn && isAdmin && (
                <button
                  type="button"
                  className="flex items-center justify-between rounded-2xl bg-slate-800/90 px-3 py-2 text-slate-100 active:scale-[0.98]"
                  onClick={() => {
                    setMenuOpen(false);
                    onGoToAdmin();
                  }}
                >
                  <span>Admin panel</span>
                </button>
              )}

              {isSignedIn && (
                <button
                  type="button"
                  className="flex items-center justify-between rounded-2xl bg-slate-800/90 px-3 py-2 text-slate-100 active:scale-[0.98]"
                  onClick={handleSignOut}
                >
                  <span>Sign out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
