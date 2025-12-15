import { create } from "zustand";

import type { Bench } from "./useBenchStore";

export type BenchEditorMode = "idle" | "choosing-location" | "details";

export type BenchEditorState = {
  editingBench: Bench | null;

  pendingFiles: File[] | null;
  chosenLocation: [number, number] | null;

  locationInput: string;
  locationInputError: string | null;
  locationInputDirty: boolean;

  draftDescription: string;

  isSubmitting: boolean;
  submitError: string | null;

  existingPhotoUrls: string[];
  removedExistingPhotoUrls: string[];

  actions: {
    reset: () => void;

    setEditingBench: (bench: Bench | null) => void;

    setPendingFiles: (files: File[] | null) => void;
    appendPendingFiles: (files: File[]) => void;
    removePendingPhoto: (index: number) => void;
    movePendingPhoto: (fromIndex: number, toIndex: number) => void;

    setChosenLocation: (value: [number, number] | null) => void;

    setLocationInput: (value: string) => void;
    setLocationInputError: (value: string | null) => void;
    setLocationInputDirty: (value: boolean) => void;

    setDraftDescription: (value: string) => void;

    setIsSubmitting: (value: boolean) => void;
    setSubmitError: (value: string | null) => void;

    setExistingPhotoUrls: (urls: string[]) => void;
    setRemovedExistingPhotoUrls: (urls: string[]) => void;
    removeExistingPhoto: (index: number) => void;
  };
};

export const useBenchEditorStore = create<BenchEditorState>((set, get) => ({
  editingBench: null,

  pendingFiles: null,
  chosenLocation: null,

  locationInput: "",
  locationInputError: null,
  locationInputDirty: false,

  draftDescription: "",

  isSubmitting: false,
  submitError: null,

  existingPhotoUrls: [],
  removedExistingPhotoUrls: [],

  actions: {
    reset: () => {
      set({
        editingBench: null,
        pendingFiles: null,
        chosenLocation: null,
        locationInput: "",
        locationInputError: null,
        locationInputDirty: false,
        draftDescription: "",
        isSubmitting: false,
        submitError: null,
        existingPhotoUrls: [],
        removedExistingPhotoUrls: [],
      });
    },

    setEditingBench: (bench) => set({ editingBench: bench }),

    setPendingFiles: (files) => set({ pendingFiles: files }),

    appendPendingFiles: (files) => {
      if (!files || files.length === 0) return;
      const current = get().pendingFiles ?? [];
      set({ pendingFiles: [...current, ...files] });
    },

    removePendingPhoto: (index) => {
      const current = get().pendingFiles;
      if (!current) return;
      const next = current.filter((_, i) => i !== index);
      set({ pendingFiles: next.length > 0 ? next : null });
    },

    movePendingPhoto: (fromIndex, toIndex) => {
      const current = get().pendingFiles;
      if (!current) return;
      if (fromIndex === toIndex) return;
      if (toIndex < 0 || toIndex >= current.length) return;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      if (!item) return;
      next.splice(toIndex, 0, item);
      set({ pendingFiles: next });
    },

    setChosenLocation: (value) => set({ chosenLocation: value }),

    setLocationInput: (value) => set({ locationInput: value }),
    setLocationInputError: (value) => set({ locationInputError: value }),
    setLocationInputDirty: (value) => set({ locationInputDirty: value }),

    setDraftDescription: (value) => set({ draftDescription: value }),

    setIsSubmitting: (value) => set({ isSubmitting: value }),
    setSubmitError: (value) => set({ submitError: value }),

    setExistingPhotoUrls: (urls) => set({ existingPhotoUrls: urls }),
    setRemovedExistingPhotoUrls: (urls) => set({ removedExistingPhotoUrls: urls }),

    removeExistingPhoto: (index) => {
      const existing = get().existingPhotoUrls;
      if (index < 0 || index >= existing.length) return;

      const removedUrl = existing[index];
      const nextExisting = existing.filter((_, i) => i !== index);
      const removed = get().removedExistingPhotoUrls;
      const nextRemoved = removedUrl
        ? removed.includes(removedUrl)
          ? removed
          : [...removed, removedUrl]
        : removed;

      set({ existingPhotoUrls: nextExisting, removedExistingPhotoUrls: nextRemoved });
    },
  },
}));
