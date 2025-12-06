export function AdminPage() {
  return (
    <div className="flex h-dvh w-dvw flex-col items-center justify-center bg-slate-950 text-slate-50">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5 text-center shadow-lg shadow-slate-900/80">
        <p className="text-sm font-semibold tracking-wide text-sky-200">
          Admin moderation
        </p>
        <p className="mt-1 text-xs text-slate-300/90">
          This screen will later list benches waiting for approval.
        </p>
      </div>
    </div>
  );
}
