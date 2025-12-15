import type { Bench } from "../../store/useBenchStore";
import { useBenchEditorController } from "../../hooks/useBenchEditorController";

export type BenchPopupProps = {
  bench: Bench;
  popupPhotos: string[];
  isAdmin: boolean;
  userId: string | null;
  openSignIn: () => void;
  onOpenPhotoPreview: (photos: string[], index: number) => void;
};

export function BenchPopup({
  bench,
  popupPhotos,
  isAdmin,
  userId,
  openSignIn,
  onOpenPhotoPreview,
}: BenchPopupProps) {
  const editor = useBenchEditorController({
    user: userId ? { id: userId } : null,
    isAdmin,
    openSignIn,
  });

  return (
    <div className="flex max-w-[220px] flex-col gap-2">
      {bench.description && (
        <div className="text-xs text-slate-800">{bench.description}</div>
      )}
      {popupPhotos.length > 0 && (
        <div
          className="popup-gallery flex gap-2 overflow-x-auto pb-1"
          onWheel={editor.handlePopupGalleryWheel}
        >
          {popupPhotos.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/40 shadow"
              onClick={() => onOpenPhotoPreview(popupPhotos, index)}
            >
              <img
                src={url}
                loading="lazy"
                alt={bench.description ?? "Bench photo"}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {(isAdmin || (userId && bench.createdBy === userId)) && (
        <button
          type="button"
          className="mt-1 inline-flex self-start rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-50"
          onClick={() => editor.startEditingBench(bench)}
        >
          Edit
        </button>
      )}
      {isAdmin && bench.status === "pending" && (
        <div className="mt-1 inline-flex self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          Pending
        </div>
      )}
    </div>
  );
}
