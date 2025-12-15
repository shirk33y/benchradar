import { useEffect, useMemo, useRef } from "react";

import { useMapStore } from "../../store/useMapStore";
import { useBenchEditorStore } from "../../store/useBenchEditorStore";
import { useBenchStore } from "../../store/useBenchStore";
import { BenchEditorForm } from "../bench/BenchEditorForm";
import { useBenchEditorController } from "../../hooks/useBenchEditorController";
import { formatLatLngInput, parseLatLngInput } from "../../lib/geo";

export function AddBenchMenu() {
  const {
    addMode,
    isAddOpen,
    toggleAdd,
    setAddOpen,
    setAddMode,
    openSignIn,
    user,
    isAdmin,
    map,
    setCenter,
    userLocation,
  } = useMapStore();
  const isSignedIn = !!user;
  const userId = user?.id ?? null;

  const editorState = useBenchEditorStore();
  const benches = useBenchStore((s) => s.benches);
  const selectFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useMemo(() => ({ current: map }), [map]);
  const editor = useBenchEditorController({
    user: userId ? { id: userId } : null,
    isAdmin,
    openSignIn,
    mapRef,
    setCenter,
  });

  const mode = editorState.editingBench ? "edit" : "create";
  const canDelete =
    mode === "edit" &&
    !!editorState.editingBench &&
    (isAdmin || (!!userId && editorState.editingBench.createdBy === userId));

  const showIdle = addMode === "idle";
  const showChoosing = addMode === "choosing-location";
  const showDetails = addMode === "details";

  useEffect(() => {
    if (addMode === "idle") {
      editorState.actions.reset();
    }
  }, [addMode]);

  useEffect(() => {
    if (!isAdmin) return;
    const stored = sessionStorage.getItem("admin_edit_bench");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { id?: string };
      const existing = parsed?.id ? benches.find((b) => b.id === parsed.id) : null;
      if (existing) {
        editor.startEditingBench(existing);
        sessionStorage.removeItem("admin_edit_bench");
      }
    } catch {
      sessionStorage.removeItem("admin_edit_bench");
    }
  }, [benches, isAdmin]);

  const handleStartChoosingLocation = () => {
    const mapInstance = map;

    if (!mapInstance) {
      setAddMode("choosing-location");
      return;
    }

    const parsedFromInput = parseLatLngInput(editorState.locationInput);
    const target =
      parsedFromInput ??
      (editorState.chosenLocation
        ? ([editorState.chosenLocation[0], editorState.chosenLocation[1]] as [number, number])
        : userLocation && Array.isArray(userLocation)
        ? ([userLocation[0], userLocation[1]] as [number, number])
        : null);

    if (target) {
      mapInstance.closePopup();
      mapInstance.setView({ lat: target[0], lng: target[1] }, 17, { animate: true });
      editorState.actions.setChosenLocation([target[0], target[1]]);
      editorState.actions.setLocationInput(formatLatLngInput(target[0], target[1]));
      editorState.actions.setLocationInputDirty(false);
      editorState.actions.setLocationInputError(null);
    }

    setAddMode("choosing-location");
  };

  return (
    <>
      <input
        ref={selectFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => editor.handleFilesSelected(e.target.files)}
      />
      <input
        ref={cameraFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => editor.handleFilesSelected(e.target.files)}
      />

      {showIdle && (
        <>
          <button
            type="button"
            className="absolute bottom-8 right-6 z-[1000] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-300 text-slate-950 shadow-[0_18px_40px_rgba(56,189,248,0.55)] outline-none ring-2 ring-sky-300/40 transition active:scale-95"
            aria-label="Add a bench"
            onClick={() => {
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
              onClick={editor.handleChooseLocation}
            >
              Choose
            </button>
          </div>
        </>
      )}

      {showDetails && (
        <div
          className="fixed inset-x-0 bottom-0 z-[1100] flex justify-center px-3 pb-3"
          data-testid="add-bench-ui"
        >
          <div className="w-full max-w-md rounded-t-3xl border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-4 shadow-[0_-18px_40px_rgba(15,23,42,0.95)]">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-600/80" />
            </div>
            <BenchEditorForm
              mode={mode}
              heading={mode === "edit" ? "Edit bench" : "New bench"}
              headingDetails={
                mode === "edit" ? (
                  <span>
                    You can update the location, description, or add/remove photos.
                  </span>
                ) : (
                  <span>Share a photo of a new bench!</span>
                )
              }
              locationInput={editorState.locationInput}
              onLocationInputChange={editor.handleLocationInputChange}
              onLocationInputBlur={editor.handleLocationInputBlur}
              locationInputError={editorState.locationInputError}
              onStartChoosingLocation={handleStartChoosingLocation}
              locationLabel={mode === "edit" ? "Location" : "Coordinates"}
              locationPlaceholder="e.g. 54.647800,-2.150950"
              existingPhotoUrls={editorState.existingPhotoUrls}
              onRemoveExistingPhoto={mode === "edit" ? editor.handleRemoveExistingPhoto : undefined}
              pendingFileList={editor.pendingFileList}
              dragFromIndexRef={editor.dragFromIndexRef}
              onReorderPendingPhoto={editor.movePhoto}
              onRemovePendingPhoto={editor.removePhoto}
              onAddPhotoClick={() => {
                if (!isSignedIn) return;
                setAddOpen(false);
                selectFileInputRef.current?.click();
              }}
              description={editorState.draftDescription}
              onDescriptionChange={editorState.actions.setDraftDescription}
              onCancel={() => setAddMode("idle")}
              onSubmit={mode === "edit" ? editor.handleEditSubmit : editor.handleCreateSubmit}
              submitLabels={{
                idle: mode === "edit" ? "Save" : "Continue",
                submitting: mode === "edit" ? "Saving..." : "Submitting...",
              }}
              canDelete={canDelete}
              onDelete={
                mode === "edit" && editorState.editingBench
                  ? () => {
                      if (!editorState.editingBench) return;
                      void editor.handleDeleteBench(editorState.editingBench);
                    }
                  : undefined
              }
              deleteLabel={mode === "edit" ? "Delete" : "Delete"}
              isSubmitting={editorState.isSubmitting}
              submitError={editorState.submitError}
            />
          </div>
        </div>
      )}
    </>
  );
}
