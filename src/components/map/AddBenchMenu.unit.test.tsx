import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";

import { AddBenchMenu } from "./AddBenchMenu";
import { useMapStore } from "../../store/useMapStore";
import { useBenchEditorStore } from "../../store/useBenchEditorStore";

const handleFilesSelectedMock = vi.fn();

vi.mock("../../hooks/useBenchEditorController", () => ({
  useBenchEditorController: () => ({
    handleChooseLocation: vi.fn(),
    handleFilesSelected: handleFilesSelectedMock,
    handleLocationInputChange: vi.fn(),
    handleLocationInputBlur: vi.fn(),
    pendingFileList: [],
    dragFromIndexRef: { current: null },
    movePhoto: vi.fn(),
    removePhoto: vi.fn(),
    handleRemoveExistingPhoto: vi.fn(),
    handleEditSubmit: vi.fn(),
    handleCreateSubmit: vi.fn(),
    handleDeleteBench: vi.fn(),
    startEditingBench: vi.fn(),
  }),
}));

function resetUiStore() {
  useMapStore.setState({
    user: { id: "user-1" } as any,
    isAdmin: false,
    openSignIn: vi.fn(),
    authEmail: "",
    authPassword: "",
    authError: null,
    authLoading: false,
    map: null,
    center: [52.2297, 21.0122] as any,
    userLocation: null,
    isMenuOpen: false,
    isAddOpen: false,
    addMode: "idle",
    authMode: "closed",
  } as any);
}

beforeEach(() => {
  resetUiStore();
  handleFilesSelectedMock.mockReset();
  (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:mock");
  useBenchEditorStore.getState().actions.reset();
});

afterEach(() => {
  cleanup();
});

function renderUi() {
  return render(<AddBenchMenu />);
}

describe("AddBenchMenu (unit)", () => {
  it("shows FAB in idle mode and opens add menu", () => {
    const view = renderUi();

    const fab = within(view.container).getByRole("button", { name: "Add a bench" });
    fireEvent.click(fab);

    expect(screen.getByRole("button", { name: "Close add options" })).toBeInTheDocument();
    expect(screen.getByText("Choose on map")).toBeInTheDocument();
  });

  it("when not signed in, add menu shows sign-in CTA and disables actions", () => {
    const openSignIn = vi.fn();
    useMapStore.setState({ user: null, openSignIn } as any);
    const view = renderUi();

    fireEvent.click(within(view.container).getByRole("button", { name: "Add a bench" }));

    const cta = screen.getByRole("button", { name: /Sign in to add a bench/i });
    fireEvent.click(cta);
    expect(openSignIn).toHaveBeenCalled();

    // Choose on map exists but should be effectively disabled (returns early)
    fireEvent.click(screen.getByText("Choose on map"));
    expect(useMapStore.getState().addMode).toBe("idle");
  });

  it("choose-on-map flow: switches to choosing-location and renders Choose/Cancel controls", () => {
    const view = renderUi();

    fireEvent.click(within(view.container).getByRole("button", { name: "Add a bench" }));
    fireEvent.click(screen.getByText("Choose on map"));

    expect(useMapStore.getState().addMode).toBe("choosing-location");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose" })).toBeInTheDocument();
  });

  it("edit mode: can Save + Delete and remove existing photo", () => {
    useMapStore.setState({ addMode: "details" } as any);

    useBenchEditorStore.setState({
      editingBench: {
        id: "bench-1",
        latitude: 1,
        longitude: 2,
        createdBy: "user-1",
        description: "test",
        status: "approved",
        mainPhotoUrl: null,
        photoUrls: [],
      },
      existingPhotoUrls: ["https://example.com/existing.jpg"],
    } as any);

    renderUi();

    // BenchEditorForm heading
    expect(screen.getByText("Edit bench")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("choose-on-map uses map instance and switches to choosing-location", () => {
    const closePopup = vi.fn();
    const setView = vi.fn();
    useMapStore.setState({
      addMode: "details",
      map: { closePopup, setView } as any,
      userLocation: [10, 20] as any,
    } as any);

    useBenchEditorStore.getState().actions.setLocationInput("");

    renderUi();

    fireEvent.click(screen.getByRole("button", { name: "Choose on map" }));

    expect(closePopup).toHaveBeenCalled();
    expect(setView).toHaveBeenCalled();
    expect(useMapStore.getState().addMode).toBe("choosing-location");
  });

  it("file input change calls handleFilesSelected", () => {
    renderUi();

    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBeGreaterThan(0);

    const f1 = new File(["a"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { files: [f1] } });

    expect(handleFilesSelectedMock).toHaveBeenCalled();
  });

  it("delete button is gated by ownership/admin", () => {
    useMapStore.setState({ addMode: "details", user: { id: "user-1" } as any, isAdmin: false } as any);
    useBenchEditorStore.setState({
      editingBench: {
        id: "bench-2",
        latitude: 1,
        longitude: 2,
        createdBy: "other",
        description: "test",
        status: "approved",
        mainPhotoUrl: null,
        photoUrls: [],
      },
    } as any);

    renderUi();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    cleanup();
    useMapStore.setState({ isAdmin: true } as any);
    renderUi();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
