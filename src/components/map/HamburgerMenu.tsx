import { useMapStore } from "../../store/useMapStore";
import { useNavigate } from "react-router-dom";

export function HamburgerMenu() {
  const navigate = useNavigate();
  const {
    isMenuOpen,
    toggleMenu,
    setMenuOpen,
    user,
    isAdmin,
    openSignIn,
    handleSignOut,
  } = useMapStore();
  const isSignedIn = !!user;
  const userEmail = user?.email ?? null;

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
                  className="flex items-center justify-between rounded-2xl border border-sky-500/40 bg-slate-900/90 px-3 py-2 text-[13px] font-semibold text-sky-200 shadow-inner shadow-slate-900/40 active:scale-[0.98]"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/admin");
                  }}
                >
                  <span>Admin panel</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    className="h-4 w-4 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M11.293 4.293a1 1 0 0 1 1.414 0l4 3.999a1 1 0 0 1 0 1.414l-4 4.001a1 1 0 0 1-1.414-1.414L13.586 10H4a1 1 0 0 1 0-2h9.586l-2.293-2.293a1 1 0 0 1 0-1.414Z" />
                  </svg>
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
