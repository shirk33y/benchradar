import type { MutableRefObject, ReactNode } from "react";

type SubmitLabelConfig = {
  idle?: string;
  submitting?: string;
};

type BenchEditorFormProps = {
  className?: string;
  mode?: "create" | "edit";
  heading?: string;
  headingDetails?: ReactNode;
  locationLabel?: string;
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  onLocationInputBlur: () => void;
  locationInputError?: string | null;
  onStartChoosingLocation?: () => void;
  chooseLocationLabel?: string;
  locationPlaceholder?: string;
  existingPhotoUrls?: string[];
  onRemoveExistingPhoto?: (index: number) => void;
  pendingFileList?: File[];
  dragFromIndexRef?: MutableRefObject<number | null>;
  onReorderPendingPhoto?: (from: number, to: number) => void;
  onRemovePendingPhoto?: (index: number) => void;
  onAddPhotoClick?: () => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  descriptionPlaceholder?: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabels?: SubmitLabelConfig;
  canDelete?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  isSubmitting: boolean;
  submitError?: string | null;
};

export function BenchEditorForm({
  className,
  mode = "create",
  heading = mode === "edit" ? "Edit bench" : "New bench",
  headingDetails,
  locationLabel = "Coordinates",
  locationInput,
  onLocationInputChange,
  onLocationInputBlur,
  locationInputError,
  onStartChoosingLocation,
  chooseLocationLabel = "Choose on map",
  locationPlaceholder = "e.g. 54.647800,-2.150950",
  existingPhotoUrls = [],
  onRemoveExistingPhoto,
  pendingFileList = [],
  dragFromIndexRef,
  onReorderPendingPhoto,
  onRemovePendingPhoto,
  onAddPhotoClick,
  description,
  onDescriptionChange,
  descriptionPlaceholder = "Add a short note about this bench...",
  onCancel,
  onSubmit,
  submitLabels,
  canDelete = false,
  onDelete,
  deleteLabel = "Delete",
  isSubmitting,
  submitError,
}: BenchEditorFormProps) {
  const computedSubmitLabel = isSubmitting
    ? submitLabels?.submitting ??
      (mode === "edit" ? "Saving..." : "Submitting...")
    : submitLabels?.idle ?? (mode === "edit" ? "Save" : "Continue");

  const allowDrag = Boolean(dragFromIndexRef && onReorderPendingPhoto);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
        <span className="font-medium">{heading}</span>
        {onStartChoosingLocation && (
          <button
            type="button"
            className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 active:scale-[0.98]"
            onClick={onStartChoosingLocation}
          >
            {chooseLocationLabel}
          </button>
        )}
      </div>

      {headingDetails && (
        <div className="mb-3 text-[11px] text-slate-400">{headingDetails}</div>
      )}

      <div className="mt-1 flex flex-col gap-1 text-[11px] text-slate-300">
        <label className="font-medium text-slate-300">{locationLabel}</label>
        <input
          type="text"
          value={locationInput}
          onChange={(event) => onLocationInputChange(event.target.value)}
          onBlur={onLocationInputBlur}
          placeholder={locationPlaceholder}
          className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/70"
        />
        {locationInputError && (
          <div className="text-[10px] text-rose-300">{locationInputError}</div>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] text-slate-400">Photos</div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {existingPhotoUrls.map((url, index) => (
            <div
              key={`existing-${url}-${index}`}
              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/90"
            >
              <img
                src={url}
                alt="Current photo"
                className="h-full w-full object-cover"
              />
              {onRemoveExistingPhoto && (
                <button
                  type="button"
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80 text-[9px] text-slate-950 shadow"
                  onClick={() => onRemoveExistingPhoto(index)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {pendingFileList.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              draggable={allowDrag}
              onDragStart={
                allowDrag
                  ? () => {
                      if (dragFromIndexRef) {
                        dragFromIndexRef.current = index;
                      }
                    }
                  : undefined
              }
              onDragOver={
                allowDrag
                  ? (event) => {
                      event.preventDefault();
                    }
                  : undefined
              }
              onDrop={
                allowDrag
                  ? (event) => {
                      event.preventDefault();
                      const from = dragFromIndexRef?.current;
                      if (
                        from === null ||
                        from === undefined ||
                        from === index ||
                        !onReorderPendingPhoto
                      ) {
                        return;
                      }
                      onReorderPendingPhoto(from, index);
                      if (dragFromIndexRef) {
                        dragFromIndexRef.current = null;
                      }
                    }
                  : undefined
              }
              className="relative flex h-20 w-20 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/90 text-[10px] text-slate-200"
            >
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
              />
              {onRemovePendingPhoto && (
                <button
                  type="button"
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80 text-[9px] text-slate-950 shadow"
                  onClick={() => onRemovePendingPhoto(index)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            aria-label="Add photos"
            className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-900/70 text-xl text-slate-300 active:scale-[0.99]"
            onClick={onAddPhotoClick ?? (() => {})}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] text-slate-400">Description</div>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400/70"
          placeholder={descriptionPlaceholder}
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        {canDelete && onDelete && (
          <button
            type="button"
            className="rounded-2xl border border-rose-700/80 bg-rose-700/20 px-3 py-2 font-semibold text-rose-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onDelete}
            disabled={isSubmitting}
          >
            {deleteLabel}
          </button>
        )}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-2 font-medium text-slate-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-2xl bg-sky-500/90 px-5 py-2 font-semibold text-slate-950 shadow-lg shadow-sky-900/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {computedSubmitLabel}
          </button>
        </div>
      </div>

      {submitError && (
        <div className="mt-2 text-[11px] text-rose-300">{submitError}</div>
      )}
    </div>
  );
}
