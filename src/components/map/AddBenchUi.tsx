import type { MutableRefObject, RefObject } from "react";
import type { LatLngExpression } from "leaflet";

import { useMapUiStore, type AddMode } from "../../store/useMapUiStore";

function formatLatLng(loc: LatLngExpression | null): string {
  if (!loc) return "Not chosen yet";
  if (Array.isArray(loc) && loc.length >= 2) {
    const [lat, lng] = loc as [number, number];
    return `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
  }
  return "Location selected";
}

export type AddBenchUiProps = {
  isSignedIn: boolean;
  selectFileInputRef: RefObject<HTMLInputElement | null>;
  cameraFileInputRef: RefObject<HTMLInputElement | null>;
  chosenLocation: LatLngExpression | null;
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  onApplyLocationInput: () => void;
  locationInputError: string | null;
  draftDescription: string;
  setDraftDescription: (value: string) => void;
  pendingFileList: File[];
  dragFromIndexRef: MutableRefObject<number | null>;
  handleChooseLocation: () => void;
  handleSubmit: () => void;
  removePhoto: (index: number) => void;
  movePhoto: (from: number, to: number) => void;
  openSignIn: () => void;
  submitError: string | null;
  isSubmitting: boolean;
  mode?: "create" | "edit";
  existingMainPhotoUrl?: string | null;
  canDelete?: boolean;
  onDeleteBench?: () => void;
  onRemoveExistingPhoto?: () => void;
};

export function AddBenchUi({
  isSignedIn,
  selectFileInputRef,
  cameraFileInputRef,
  chosenLocation,
  locationInput,
  onLocationInputChange,
  onApplyLocationInput,
  locationInputError,
  draftDescription,
  setDraftDescription,
  pendingFileList,
  dragFromIndexRef,
  handleChooseLocation,
  handleSubmit,
  removePhoto,
  movePhoto,
  openSignIn,
  submitError,
  isSubmitting,
  mode = "create",
  existingMainPhotoUrl = null,
  canDelete = false,
  onDeleteBench,
  onRemoveExistingPhoto,
}: AddBenchUiProps) {
  const { addMode, isAddOpen, toggleAdd, setAddOpen, setAddMode } = useMapUiStore();

  const showIdle = addMode === "idle";
  const showChoosing = addMode === "choosing-location";
  const showDetails = addMode === "details";

  return (
    <>
      {showIdle && (
        <>
          <button
            type="button"
            className="absolute bottom-8 right-6 z-[1000] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-300 text-slate-950 shadow-[0_18px_40px_rgba(56,189,248,0.55)] outline-none ring-2 ring-sky-300/40 transition active:scale-95"
            aria-label="Add a bench"
            onClick={toggleAdd}
          >
            <span className="text-3xl leading-none">+</span>
          </button>

          {isAddOpen && (
            <div className="fixed inset-0 z-[950] bg-slate-950/25 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0 h-full w-full cursor-default"
                aria-label="Close add options"
                onClick={() => setAddOpen(false)}
              />

              <div className="absolute bottom-24 right-6 w-60 rounded-3xl border border-slate-800/70 bg-slate-900/92 px-2 py-2 text-slate-50 shadow-[0_20px_45px_rgba(15,23,42,0.95)] backdrop-blur-xl">
                <div className="flex flex-col gap-0.5 text-xs">
                  {!isSignedIn && (
                    <button
                      type="button"
                      className="mb-1 flex items-center gap-2 rounded-2xl bg-sky-500/90 px-3 py-2 text-[11px] font-medium text-slate-950 active:scale-[0.98]"
                      onClick={openSignIn}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-[12px]">
                        🔐
                      </span>
                      <span>Sign in to add a bench</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 active:bg-slate-800/80 ${
                      !isSignedIn ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    onClick={() => {
                      if (!isSignedIn) return;
                      setAddOpen(false);
                      selectFileInputRef.current?.click();
                    }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/90 text-[12px] text-slate-950">
                      🖼️
                    </span>
                    <span className="font-medium">Select photo</span>
                  </button>

                  <button
                    type="button"
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 active:bg-slate-800/80 ${
                      !isSignedIn ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    onClick={() => {
                      if (!isSignedIn) return;
                      setAddOpen(false);
                      cameraFileInputRef.current?.click();
                    }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/95 text-[12px] text-slate-950">
                      📷
                    </span>
                    <span className="font-medium">Take photo</span>
                  </button>

                  <button
                    type="button"
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 active:bg-slate-800/80 ${
                      !isSignedIn ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    onClick={() => {
                      if (!isSignedIn) return;
                      setAddOpen(false);
                      setAddMode("choosing-location");
                    }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-300/95 text-[12px] text-slate-950">
                      📍
                    </span>
                    <span className="font-medium">Choose on map</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showChoosing && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="h-7 w-7 rounded-full border-2 border-sky-300/90 bg-sky-400/40 shadow-[0_0_0_2px_rgba(15,23,42,0.9)]" />
          </div>

          <div className="absolute bottom-8 right-4 z-[1000] flex gap-3">
            <button
              type="button"
              className="rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-xs font-medium text-slate-100 active:scale-[0.98]"
              onClick={() => setAddMode("idle")}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-2xl bg-sky-500/90 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-sky-900/70 active:scale-[0.98]"
              onClick={handleChooseLocation}
            >
              Choose
            </button>
          </div>
        </>
      )}

      {showDetails && (
        <div className="absolute inset-0 z-[1200] flex items-end justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-md rounded-t-3xl border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-4 shadow-[0_-18px_40px_rgba(15,23,42,0.95)]">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-600/80" />
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium">
                {mode === "edit" ? "Edit bench" : "New bench"}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <div>
                <div className="font-medium">Location</div>
                <div className="text-slate-400">
                  {formatLatLng(chosenLocation)}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 active:scale-[0.98]"
                onClick={() => setAddMode("choosing-location")}
              >
                Choose on map
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-[11px]">
              <label className="text-slate-400">Paste coordinates</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => onLocationInputChange(e.target.value)}
                  placeholder="e.g. 54.647800,-2.150950"
                  className="flex-1 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/70"
                />
                <button
                  type="button"
                  className="rounded-2xl bg-slate-100/10 px-4 py-2 text-xs font-semibold text-slate-100 shadow-sm shadow-slate-900/50 active:scale-[0.98]"
                  onClick={onApplyLocationInput}
                >
                  Apply
                </button>
              </div>
              {locationInputError && (
                <div className="text-[10px] text-rose-300">{locationInputError}</div>
              )}
            </div>

            <div className="mt-3">
              <div className="mb-1 text-[11px] text-slate-400">Photos</div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {mode === "edit" && existingMainPhotoUrl && (
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/90">
                    <img
                      src={existingMainPhotoUrl}
                      alt="Current photo"
                      className="max-h-full max-w-full object-contain"
                    />
                    {onRemoveExistingPhoto && (
                      <button
                        type="button"
                        className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80 text-[9px] text-slate-950 shadow"
                        onClick={onRemoveExistingPhoto}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {pendingFileList.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    draggable
                    onDragStart={() => {
                      dragFromIndexRef.current = index;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragFromIndexRef.current;
                      if (from === null || from === index) return;
                      movePhoto(from, index);
                      dragFromIndexRef.current = null;
                    }}
                    className="relative flex h-20 w-20 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/90 text-[10px] text-slate-200"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80 text-[9px] text-slate-950 shadow"
                      onClick={() => removePhoto(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  aria-label="Add photos"
                  className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-900/70 text-xl text-slate-300 active:scale-[0.99]"
                  onClick={() => selectFileInputRef.current?.click()}
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-[11px] text-slate-400">Description</div>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/70"
                placeholder="Add a short note about this bench..."
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              {mode === "edit" && canDelete && onDeleteBench && (
                <button
                  type="button"
                  className="rounded-2xl border border-rose-700/80 bg-rose-700/20 px-3 py-2 font-semibold text-rose-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={onDeleteBench}
                  disabled={isSubmitting}
                >
                  Delete
                </button>
              )}

              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-2 font-medium text-slate-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => setAddMode("idle")}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-sky-500/90 px-5 py-2 font-semibold text-slate-950 shadow-lg shadow-sky-900/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? mode === "edit"
                      ? "Saving..."
                      : "Submitting..."
                    : mode === "edit"
                    ? "Save"
                    : "Continue"}
                </button>
              </div>
            </div>
            {submitError && (
              <div className="mt-2 text-[11px] text-rose-300">{submitError}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
