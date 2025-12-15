import { useRef } from "react";
import type { MutableRefObject, WheelEvent } from "react";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";

import type { Bench } from "../store/useBenchStore";
import { useBenchStore } from "../store/useBenchStore";
import { useBenchEditorStore } from "../store/useBenchEditorStore";
import { useMapStore } from "../store/useMapStore";
import { extractGpsFromFiles } from "../lib/photoMetadata";
import { formatLatLngInput } from "../lib/geo";
import { parseAndFormatLatLngInput, validateLatLngInput } from "../lib/geo";
import {
  canEditBench,
  createBench,
  deleteBench,
  deleteBenchPhotosByUrls,
  insertBenchPhotos,
  uploadPendingBenchPhotos,
  updateBenchDetails,
} from "../repositories/benchRepository";
import { getCurrentUser } from "../repositories/authRepository";

type UseBenchEditorControllerArgs = {
  benches?: Bench[];
  setBenches?: (benches: Bench[]) => void;
  user?: { id: string; email?: string | null } | null;
  isAdmin?: boolean;
  openSignIn?: () => void;
  mapRef?: MutableRefObject<LeafletMap | null>;
  setCenter?: (center: LatLngExpression) => void;
  setAddMode?: (mode: "idle" | "choosing-location" | "details") => void;
};

export function useBenchEditorController(args: UseBenchEditorControllerArgs = {}) {
  const benchStore = useBenchStore();
  const mapStore = useMapStore();
  const internalMapRef = useRef<LeafletMap | null>(null);

  const benches = args.benches ?? benchStore.benches;
  const setBenches = args.setBenches ?? benchStore.setBenches;
  const user = args.user ?? null;
  const isAdmin = args.isAdmin ?? false;
  const openSignIn = args.openSignIn ?? (() => {});
  const mapRef = args.mapRef ?? internalMapRef;
  const setCenter = args.setCenter ?? (() => {});
  const setAddMode = args.setAddMode ?? mapStore.setAddMode;

  const editingBench = useBenchEditorStore((s) => s.editingBench);
  const pendingFiles = useBenchEditorStore((s) => s.pendingFiles);
  const chosenLocation = useBenchEditorStore((s) => s.chosenLocation);
  const locationInput = useBenchEditorStore((s) => s.locationInput);
  const locationInputError = useBenchEditorStore((s) => s.locationInputError);
  const locationInputDirty = useBenchEditorStore((s) => s.locationInputDirty);
  const draftDescription = useBenchEditorStore((s) => s.draftDescription);
  const isSubmitting = useBenchEditorStore((s) => s.isSubmitting);
  const submitError = useBenchEditorStore((s) => s.submitError);
  const existingPhotoUrls = useBenchEditorStore((s) => s.existingPhotoUrls);
  const removedExistingPhotoUrls = useBenchEditorStore((s) => s.removedExistingPhotoUrls);
  const actions = useBenchEditorStore((s) => s.actions);

  const dragFromIndexRef = useRef<number | null>(null);

  const pendingFileList = pendingFiles ?? [];
  const isSignedIn = !!user;
  const userEmail = user?.email ?? null;

  const resetEditor = () => {
    setAddMode("idle");
    actions.reset();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    actions.appendPendingFiles(incoming);

    if (incoming.length > 0) {
      const gpsLocation = await extractGpsFromFiles(incoming);
      if (gpsLocation && !chosenLocation) {
        const locationExpression: LatLngExpression = [
          gpsLocation[0],
          gpsLocation[1],
        ];
        setCenter(locationExpression);
        if (mapRef.current) {
          mapRef.current.setView({
            lat: gpsLocation[0],
            lng: gpsLocation[1],
          });
        }
        actions.setChosenLocation([gpsLocation[0], gpsLocation[1]]);
        actions.setLocationInput(formatLatLngInput(gpsLocation[0], gpsLocation[1]));
        actions.setLocationInputDirty(false);
        actions.setLocationInputError(null);
      }
    }

    setAddMode("details");
  };

  const handleLocationInputChange = (value: string) => {
    if (!locationInputDirty) {
      actions.setLocationInputDirty(true);
    }
    actions.setLocationInput(value);
    actions.setLocationInputError(validateLatLngInput(value));
  };

  const handleLocationInputBlur = () => {
    if (!locationInputDirty) {
      actions.setLocationInputDirty(true);
    }

    const error = validateLatLngInput(locationInput);
    actions.setLocationInputError(error);
    if (error) {
      return;
    }

    const parsed = parseAndFormatLatLngInput(locationInput);
    if (!parsed) return;

    const { lat, lng, formatted } = parsed;
    const location: LatLngExpression = [lat, lng];
    actions.setChosenLocation([lat, lng]);
    setCenter(location);
    actions.setLocationInput(formatted);
    if (mapRef.current) {
      mapRef.current.setView({ lat, lng });
    }
    actions.setLocationInputError(null);
  };

  const handleChooseLocation = () => {
    if (!mapRef.current) {
      setAddMode("idle");
      return;
    }
    const c = mapRef.current.getCenter();
    const location: LatLngExpression = [c.lat, c.lng];
    actions.setChosenLocation([location[0], location[1]]);
    actions.setLocationInput(formatLatLngInput(location[0], location[1]));
    actions.setLocationInputDirty(false);
    actions.setLocationInputError(null);
    setAddMode("details");
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    actions.movePendingPhoto(fromIndex, toIndex);
  };

  const removePhoto = (index: number) => {
    actions.removePendingPhoto(index);
  };

  const handleRemoveExistingPhoto = (index: number) => {
    actions.removeExistingPhoto(index);
  };

  const startEditingBench = (bench: Bench) => {
    if (!user) {
      openSignIn();
      return;
    }

    if (!isAdmin && bench.createdBy && bench.createdBy !== user.id) {
      return;
    }

    actions.setEditingBench(bench);
    actions.setDraftDescription(bench.description ?? "");
    actions.setChosenLocation([bench.latitude, bench.longitude]);
    actions.setLocationInput(formatLatLngInput(bench.latitude, bench.longitude));
    actions.setLocationInputDirty(false);
    actions.setLocationInputError(null);
    actions.setPendingFiles(null);
    actions.setSubmitError(null);
    actions.setExistingPhotoUrls(
      bench.photoUrls && bench.photoUrls.length > 0
        ? bench.photoUrls
        : bench.mainPhotoUrl
        ? [bench.mainPhotoUrl]
        : []
    );
    actions.setRemovedExistingPhotoUrls([]);
    setAddMode("details");
  };

  const handleDeleteBench = async (bench: Bench) => {
    if (!canEditBench({ userId: user?.id ?? null, isAdmin, bench })) {
      if (!user) {
        openSignIn();
      }
      return;
    }

    const confirmDelete = window.confirm(
      "Delete this bench? This cannot be undone."
    );
    if (!confirmDelete) return;

    const { error } = await deleteBench({ benchId: bench.id });
    if (error) {
      window.alert(error);
      return;
    }

    setBenches(benches.filter((b) => b.id !== bench.id));
    resetEditor();
  };

  const handleEditSubmit = async () => {
    if (!editingBench) return;

    if (!user) {
      openSignIn();
      return;
    }

    const baseLatLng: [number, number] = [
      editingBench.latitude,
      editingBench.longitude,
    ];

    const [lat, lng] =
      chosenLocation && Array.isArray(chosenLocation)
        ? (chosenLocation as [number, number])
        : baseLatLng;

    const remainingExistingUrls = existingPhotoUrls;
    const hasExisting = remainingExistingUrls.length > 0;
    const hasNew = pendingFiles && pendingFiles.length > 0;

    if (!hasExisting && !hasNew) {
      actions.setSubmitError("Add at least one photo.");
      return;
    }

    actions.setIsSubmitting(true);
    actions.setSubmitError(null);

    try {
      const uploadedUrls: string[] = [];
      let mainPhotoUrl =
        remainingExistingUrls[0] ?? editingBench.mainPhotoUrl ?? null;

      if (pendingFiles && pendingFiles.length > 0) {
        const ownerId = editingBench.createdBy ?? user.id;
        const uploadRes = await uploadPendingBenchPhotos({
          ownerId,
          files: pendingFiles,
        });

        if (uploadRes.error) {
          actions.setSubmitError(uploadRes.error);
          return;
        }

        uploadedUrls.push(...uploadRes.urls);
      }

      if (uploadedUrls.length > 0 && !mainPhotoUrl) {
        mainPhotoUrl = uploadedUrls[0];
      }

      const { error: benchError } = await updateBenchDetails({
        benchId: editingBench.id,
        latitude: lat,
        longitude: lng,
        description: draftDescription || null,
        mainPhotoUrl:
          mainPhotoUrl !== editingBench.mainPhotoUrl
            ? mainPhotoUrl
            : undefined,
      });

      if (benchError) {
        actions.setSubmitError(benchError);
        return;
      }

      if (removedExistingPhotoUrls.length > 0) {
        const { error: deleteError } = await deleteBenchPhotosByUrls({
          benchId: editingBench.id,
          urls: removedExistingPhotoUrls,
        });
        if (deleteError) {
          actions.setSubmitError(deleteError);
          return;
        }
      }

      if (uploadedUrls.length > 0) {
        const { error: insertError } = await insertBenchPhotos({
          benchId: editingBench.id,
          urls: uploadedUrls,
          mainPhotoUrl,
        });
        if (insertError) {
          actions.setSubmitError(insertError);
          return;
        }
      }

      const updatedPhotoUrls = [...remainingExistingUrls, ...uploadedUrls];

      setBenches(
        benches.map((b) =>
          b.id === editingBench.id
            ? {
                ...b,
                latitude: lat,
                longitude: lng,
                description: draftDescription || null,
                mainPhotoUrl,
                photoUrls: updatedPhotoUrls,
              }
            : b
        )
      );

      resetEditor();
    } finally {
      actions.setIsSubmitting(false);
    }
  };

  const handleCreateSubmit = async () => {
    if (!pendingFiles || pendingFiles.length === 0) {
      actions.setSubmitError("Add at least one photo.");
      return;
    }

    if (!chosenLocation || !Array.isArray(chosenLocation)) {
      actions.setSubmitError("Choose a location on the map.");
      return;
    }

    actions.setIsSubmitting(true);
    actions.setSubmitError(null);

    try {
      const authUser = await getCurrentUser();

      if (!authUser) {
        actions.setSubmitError("You need to be signed in to add a bench.");
        return;
      }

      const [lat, lng] = chosenLocation as [number, number];
      const uploadRes = await uploadPendingBenchPhotos({
        ownerId: authUser.id,
        files: pendingFiles,
      });

      if (uploadRes.error) {
        actions.setSubmitError(uploadRes.error);
        return;
      }

      const uploadedUrls = uploadRes.urls;
      const mainPhotoUrl = uploadedUrls[0] ?? null;

      const { benchId, error: benchError } = await createBench({
        createdBy: authUser.id,
        status: "pending",
        latitude: lat,
        longitude: lng,
        description: draftDescription || null,
        mainPhotoUrl,
      });

      if (benchError || !benchId) {
        actions.setSubmitError(benchError ?? "Saving bench failed. Please try again.");
        return;
      }

      if (uploadedUrls.length > 0) {
        const { error: insertError } = await insertBenchPhotos({
          benchId,
          urls: uploadedUrls,
          mainPhotoUrl,
        });
        if (insertError) {
          actions.setSubmitError(insertError);
          return;
        }
      }

      const newBench: Bench = {
        id: benchId,
        latitude: lat,
        longitude: lng,
        title: null,
        description: draftDescription || null,
        mainPhotoUrl,
        createdBy: authUser.id,
        status: "pending" as const,
      };

      setBenches([...benches, newBench]);
      resetEditor();
    } finally {
      actions.setIsSubmitting(false);
    }
  };

  const handlePopupGalleryWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (!container) return;
    const dominantDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    if (dominantDelta === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof (container as any).scrollBy === "function") {
      (container as any).scrollBy({
        left: dominantDelta,
        behavior: "smooth",
      });
    } else {
      (container as any).scrollLeft += dominantDelta;
    }
  };

  return {
    isSignedIn,
    userEmail,

    pendingFiles,
    pendingFileList,
    setPendingFiles: actions.setPendingFiles,

    chosenLocation,
    setChosenLocation: actions.setChosenLocation,

    locationInput,
    locationInputError,
    handleLocationInputChange,
    handleLocationInputBlur,
    setLocationInput: actions.setLocationInput,
    setLocationInputError: actions.setLocationInputError,
    setLocationInputDirty: actions.setLocationInputDirty,

    draftDescription,
    setDraftDescription: actions.setDraftDescription,

    isSubmitting,
    submitError,

    editingBench,
    existingPhotoUrls,
    removedExistingPhotoUrls,

    dragFromIndexRef,

    handleFilesSelected,
    handleChooseLocation,
    handleCreateSubmit,
    handleEditSubmit,
    startEditingBench,
    handleDeleteBench,

    movePhoto,
    removePhoto,
    handleRemoveExistingPhoto,

    handlePopupGalleryWheel,
    resetEditor,
  };
}
