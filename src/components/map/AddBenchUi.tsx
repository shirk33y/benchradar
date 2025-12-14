import type { MutableRefObject, RefObject } from "react";
import type { LatLngExpression } from "leaflet";

import { useMapUiStore } from "../../store/useMapUiStore";
import { BenchEditorForm } from "../bench/BenchEditorForm";

export type AddBenchUiProps = {
  isSignedIn: boolean;
  selectFileInputRef: RefObject<HTMLInputElement | null>;
  cameraFileInputRef: RefObject<HTMLInputElement | null>;
  chosenLocation: LatLngExpression | null;
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  onLocationInputBlur: () => void;
  onStartChoosingLocation: () => void;
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
  existingPhotoUrls?: string[];
  canDelete?: boolean;
  onDeleteBench?: () => void;
  onRemoveExistingPhoto?: (index: number) => void;
  onFabPress?: () => void;
};

export function AddBenchUi({
  isSignedIn,
  selectFileInputRef,
  cameraFileInputRef,
  chosenLocation,
  locationInput,
  onLocationInputChange,
  onLocationInputBlur,
  onStartChoosingLocation,
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
  existingPhotoUrls = [],
  canDelete = false,
  onDeleteBench,
  onRemoveExistingPhoto,
  onFabPress,
}: AddBenchUiProps) {
  const { addMode, isAddOpen, toggleAdd, setAddOpen, setAddMode } =
    useMapUiStore();

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
            onClick={() => {
              onFabPress?.();
              toggleAdd();
            }}
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
            <BenchEditorForm
              mode={mode}
              locationInput={locationInput}
              onLocationInputChange={onLocationInputChange}
              onLocationInputBlur={onLocationInputBlur}
              locationInputError={locationInputError}
              onStartChoosingLocation={onStartChoosingLocation}
              locationPlaceholder={
                chosenLocation && Array.isArray(chosenLocation)
                  ? `${(chosenLocation as [number, number])[0].toFixed(
                      6,
                    )},${(chosenLocation as [number, number])[1].toFixed(6)}`
                  : "e.g. 54.647800,-2.150950"
              }
              existingPhotoUrls={existingPhotoUrls}
              onRemoveExistingPhoto={onRemoveExistingPhoto}
              pendingFileList={pendingFileList}
              dragFromIndexRef={dragFromIndexRef}
              onReorderPendingPhoto={movePhoto}
              onRemovePendingPhoto={removePhoto}
              onAddPhotoClick={() => selectFileInputRef.current?.click()}
              description={draftDescription}
              onDescriptionChange={setDraftDescription}
              onCancel={() => setAddMode("idle")}
              onSubmit={handleSubmit}
              submitLabels={{
                idle: mode === "edit" ? "Save" : "Continue",
                submitting: mode === "edit" ? "Saving..." : "Submitting...",
              }}
              canDelete={mode === "edit" && canDelete}
              onDelete={mode === "edit" && canDelete ? onDeleteBench : undefined}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          </div>
        </div>
      )}
    </>
  );
}
