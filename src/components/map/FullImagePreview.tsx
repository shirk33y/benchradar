import type { PointerEvent as ReactPointerEvent } from "react";

import type { PreviewState } from "../../hooks/useFullImagePreview";

export type FullImagePreviewProps = {
  previewState: PreviewState;
  previewDragOffset: number;
  previewSwipeOffset: number;
  close: () => void;
  showRelative: (delta: number) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function FullImagePreview({
  previewState,
  previewDragOffset,
  previewSwipeOffset,
  close,
  showRelative,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: FullImagePreviewProps) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative flex w-full max-w-4xl flex-col items-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-6 top-6 z-[2100] flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-900 shadow"
          onClick={close}
        >
          ×
        </button>
        <div
          className="relative mt-8 flex w-full flex-col items-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {previewState.photos.length > 1 && previewState.index > 0 && (
            <>
              <button
                type="button"
                className="absolute left-0 top-0 z-[2040] h-full w-1/2 cursor-pointer text-transparent"
                onClick={(event) => {
                  event.stopPropagation();
                  showRelative(-1);
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                Previous
              </button>
              <button
                type="button"
                className="absolute left-3 top-1/2 z-[2050] flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  showRelative(-1);
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-8 w-8 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 6 9 12 15 18" />
                </svg>
              </button>
            </>
          )}
          {previewState.photos.length > 1 &&
            previewState.index < previewState.photos.length - 1 && (
              <>
                <button
                  type="button"
                  className="absolute right-0 top-0 z-[2040] h-full w-1/2 cursor-pointer text-transparent"
                  onClick={(event) => {
                    event.stopPropagation();
                    showRelative(1);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 z-[2050] flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg"
                  onClick={(event) => {
                    event.stopPropagation();
                    showRelative(1);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-8 w-8 text-slate-900"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              </>
            )}
          <div
            className="relative w-full overflow-hidden rounded-2xl bg-black/40 shadow-2xl"
            style={{
              height: "min(80vh, 900px)",
              transform: `translateY(${previewDragOffset}px)`,
              transition: previewDragOffset === 0 ? "transform 0.2s ease-out" : "none",
            }}
          >
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                transform: `translateX(${previewSwipeOffset}px)`,
                transition: previewSwipeOffset === 0 ? "transform 0.2s ease-out" : "none",
              }}
            >
              <img
                src={previewState.photos[previewState.index]}
                alt="Bench preview"
                className="max-h-full w-full object-contain"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-100">
            <span>
              {previewState.index + 1}/{previewState.photos.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
