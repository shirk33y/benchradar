import { describe, expect, it, beforeEach } from "vitest";

import { useBenchEditorStore } from "./useBenchEditorStore";

describe("useBenchEditorStore (unit)", () => {
  beforeEach(() => {
    useBenchEditorStore.getState().actions.reset();
  });

  it("appendPendingFiles and removePendingPhoto", () => {
    const a = new File(["a"], "a.jpg");
    const b = new File(["b"], "b.jpg");

    useBenchEditorStore.getState().actions.appendPendingFiles([a, b]);
    expect(useBenchEditorStore.getState().pendingFiles?.length).toBe(2);

    useBenchEditorStore.getState().actions.removePendingPhoto(0);
    expect(useBenchEditorStore.getState().pendingFiles?.[0]).toBe(b);

    useBenchEditorStore.getState().actions.removePendingPhoto(0);
    expect(useBenchEditorStore.getState().pendingFiles).toBe(null);
  });

  it("movePendingPhoto reorders", () => {
    const a = new File(["a"], "a.jpg");
    const b = new File(["b"], "b.jpg");

    useBenchEditorStore.getState().actions.appendPendingFiles([a, b]);
    useBenchEditorStore.getState().actions.movePendingPhoto(0, 1);

    expect(useBenchEditorStore.getState().pendingFiles?.[0]).toBe(b);
    expect(useBenchEditorStore.getState().pendingFiles?.[1]).toBe(a);
  });

  it("removeExistingPhoto tracks removed urls", () => {
    useBenchEditorStore.getState().actions.setExistingPhotoUrls(["u1", "u2"]);
    useBenchEditorStore.getState().actions.removeExistingPhoto(0);

    expect(useBenchEditorStore.getState().existingPhotoUrls).toEqual(["u2"]);
    expect(useBenchEditorStore.getState().removedExistingPhotoUrls).toEqual(["u1"]);
  });
});
