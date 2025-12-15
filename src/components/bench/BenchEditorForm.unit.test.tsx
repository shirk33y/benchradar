import { describe, expect, it, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";

import { BenchEditorForm } from "./BenchEditorForm";

function renderForm(overrides: Partial<React.ComponentProps<typeof BenchEditorForm>> = {}) {
  const dragFromIndexRef = { current: null } as any;

  const props: React.ComponentProps<typeof BenchEditorForm> = {
    mode: "create",
    locationInput: "",
    onLocationInputChange: vi.fn(),
    onLocationInputBlur: vi.fn(),
    locationInputError: null,
    onStartChoosingLocation: vi.fn(),
    existingPhotoUrls: [],
    onRemoveExistingPhoto: vi.fn(),
    pendingFileList: [],
    dragFromIndexRef,
    onReorderPendingPhoto: vi.fn(),
    onRemovePendingPhoto: vi.fn(),
    onAddPhotoClick: vi.fn(),
    description: "",
    onDescriptionChange: vi.fn(),
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
    submitError: null,
    ...overrides,
  };

  return render(<BenchEditorForm {...props} />);
}

afterEach(() => {
  cleanup();
});

describe("BenchEditorForm (unit)", () => {
  it("renders create vs edit submit labels (Continue vs Save)", () => {
    const createView = renderForm({ mode: "create" });
    expect(within(createView.container).getByRole("button", { name: "Continue" })).toBeInTheDocument();
    cleanup();

    const editView = renderForm({ mode: "edit" });
    expect(within(editView.container).getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls location handlers on change and blur; shows validation error", () => {
    const onLocationInputChange = vi.fn();
    const onLocationInputBlur = vi.fn();

    renderForm({
      locationInput: "1,2",
      onLocationInputChange,
      onLocationInputBlur,
      locationInputError: "Coordinates must be valid",
    });

    const input = screen.getByPlaceholderText("e.g. 54.647800,-2.150950");
    fireEvent.change(input, { target: { value: "3,4" } });
    expect(onLocationInputChange).toHaveBeenCalledWith("3,4");

    fireEvent.blur(input);
    expect(onLocationInputBlur).toHaveBeenCalled();

    expect(screen.getByText("Coordinates must be valid")).toBeInTheDocument();
  });

  it("supports 'Choose on map' button", () => {
    const onStartChoosingLocation = vi.fn();
    renderForm({ onStartChoosingLocation });

    fireEvent.click(screen.getByRole("button", { name: "Choose on map" }));
    expect(onStartChoosingLocation).toHaveBeenCalled();
  });

  it("supports adding/removing existing photos", () => {
    const onRemoveExistingPhoto = vi.fn();
    const onAddPhotoClick = vi.fn();

    renderForm({
      existingPhotoUrls: ["https://example.com/a.jpg"],
      onRemoveExistingPhoto,
      onAddPhotoClick,
    });

    const existingImg = screen.getByAltText("Current photo");
    const existingCard = existingImg.closest("div") as HTMLElement;
    const removeBtn = within(existingCard).getByRole("button");
    fireEvent.click(removeBtn);
    expect(onRemoveExistingPhoto).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "Add photos" }));
    expect(onAddPhotoClick).toHaveBeenCalled();
  });

  it("supports removing and reordering pending photos via drag-drop", () => {
    const file1 = new File(["a"], "a.jpg", { type: "image/jpeg" });
    const file2 = new File(["b"], "b.jpg", { type: "image/jpeg" });

    const dragFromIndexRef = { current: null } as any;
    const onReorderPendingPhoto = vi.fn();
    const onRemovePendingPhoto = vi.fn();

    // JSDOM needs createObjectURL
    (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:mock");

    const view = renderForm({
      pendingFileList: [file1, file2],
      dragFromIndexRef,
      onReorderPendingPhoto,
      onRemovePendingPhoto,
    });

    const pendingImgs = within(view.container).getAllByAltText(/\.jpg$/);
    const pendingCards = pendingImgs.map((img) => img.closest("div") as HTMLElement);

    // Drag first onto second
    fireEvent.dragStart(pendingCards[0]);
    fireEvent.dragOver(pendingCards[1]);
    fireEvent.drop(pendingCards[1]);

    expect(onReorderPendingPhoto).toHaveBeenCalledWith(0, 1);

    // Remove button exists on each pending card (✕)
    const removeBtn = within(pendingCards[0]).getByRole("button");
    fireEvent.click(removeBtn);
    expect(onRemovePendingPhoto).toHaveBeenCalledWith(0);
  });

  it("supports cancel and submit", () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    renderForm({ onCancel, onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
