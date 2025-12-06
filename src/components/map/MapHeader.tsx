export function MapHeader() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-3xl px-4 py-2 text-sm font-medium text-sky-100 shadow-lg shadow-sky-900/50 backdrop-blur-[18px] backdrop-saturate-[1.8] bg-[var(--br-aqua-bg)]">
        <div className="h-2 w-12 rounded-full bg-sky-300/70" />
        <span>BenchRadar</span>
      </div>
    </div>
  );
}
