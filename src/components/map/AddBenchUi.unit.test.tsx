import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";

import { AddBenchUi } from "./AddBenchUi";
import { useMapUiStore } from "../../store/useMapUiStore";

function resetUiStore() {
  useMapUiStore.setState({
    isMenuOpen: false,
    isAddOpen: false,
    addMode: "idle",
    authMode: "closed",
  } as any);
}

beforeEach(() => {
  resetUiStore();
  (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:mock");
});

afterEach(() => {
  cleanup();
});

function renderUi(overrides: Partial<React.ComponentProps<typeof AddBenchUi>> = {}) {
  const selectFileInputRef = { current: null } as any;
  const cameraFileInputRef = { current: null } as any;
  const dragFromIndexRef = { current: null } as any;

  const props: React.ComponentProps<typeof AddBenchUi> = {
    isSignedIn: true,
    selectFileInputRef,
    cameraFileInputRef,
    chosenLocation: null,
    locationInput: "",
    onLocationInputChange: vi.fn(),
    onLocationInputBlur: vi.fn(),
    onStartChoosingLocation: vi.fn(),
    locationInputError: null,
    draftDescription: "",
    setDraftDescription: vi.fn(),
    pendingFileList: [],
    dragFromIndexRef,
    handleChooseLocation: vi.fn(),
    handleSubmit: vi.fn(),
    removePhoto: vi.fn(),
    movePhoto: vi.fn(),
    openSignIn: vi.fn(),
    submitError: null,
    isSubmitting: false,
    ...overrides,
  };

  return render(<AddBenchUi {...props} />);
}

describe("AddBenchUi (unit)", () => {
  it("shows FAB in idle mode and opens add menu", () => {
    const view = renderUi();

    const fab = within(view.container).getByRole("button", { name: "Add a bench" });
    fireEvent.click(fab);

    expect(screen.getByRole("button", { name: "Close add options" })).toBeInTheDocument();
    expect(screen.getByText("Choose on map")).toBeInTheDocument();
  });

  it("when not signed in, add menu shows sign-in CTA and disables actions", () => {
    const openSignIn = vi.fn();
    const view = renderUi({ isSignedIn: false, openSignIn });

    fireEvent.click(within(view.container).getByRole("button", { name: "Add a bench" }));

    const cta = screen.getByRole("button", { name: /Sign in to add a bench/i });
    fireEvent.click(cta);
    expect(openSignIn).toHaveBeenCalled();

    // Choose on map exists but should be effectively disabled (returns early)
    fireEvent.click(screen.getByText("Choose on map"));
    expect(useMapUiStore.getState().addMode).toBe("idle");
  });

  it("choose-on-map flow: switches to choosing-location and renders Choose/Cancel controls", () => {
    const handleChooseLocation = vi.fn();
    const view = renderUi({ handleChooseLocation });

    fireEvent.click(within(view.container).getByRole("button", { name: "Add a bench" }));
    fireEvent.click(screen.getByText("Choose on map"));

    expect(useMapUiStore.getState().addMode).toBe("choosing-location");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(handleChooseLocation).toHaveBeenCalled();
  });

  it("edit mode: can Save + Delete and remove existing photo", () => {
    useMapUiStore.setState({ addMode: "details" } as any);

    const handleSubmit = vi.fn();
    const onDeleteBench = vi.fn();
    const onRemoveExistingPhoto = vi.fn();

    renderUi({
      mode: "edit",
      handleSubmit,
      canDelete: true,
      onDeleteBench,
      existingPhotoUrls: ["https://example.com/existing.jpg"],
      onRemoveExistingPhoto,
    });

    // BenchEditorForm heading
    expect(screen.getByText("Edit bench")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handleSubmit).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteBench).toHaveBeenCalled();

    // Existing photo remove button is ✕, no aria-label
    const img = screen.getByAltText("Current photo");
    const card = img.closest("div") as HTMLElement;
    const removeBtn = within(card).getByRole("button");
    fireEvent.click(removeBtn);
    expect(onRemoveExistingPhoto).toHaveBeenCalledWith(0);
  });
});
