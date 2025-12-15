import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

import { FullImagePreview } from "./FullImagePreview";

describe("FullImagePreview (unit)", () => {
  it("renders counter, supports next/prev and close", () => {
    const close = vi.fn();
    const showRelative = vi.fn();

    render(
      <FullImagePreview
        previewState={{ photos: ["a", "b"], index: 0 }}
        previewDragOffset={0}
        previewSwipeOffset={0}
        close={close}
        showRelative={showRelative}
        onPointerDown={vi.fn() as any}
        onPointerMove={vi.fn() as any}
        onPointerUp={vi.fn() as any}
        onPointerCancel={vi.fn() as any}
      />
    );

    expect(screen.getByAltText("Bench preview")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(showRelative).toHaveBeenCalledWith(1);

    // Re-render at index 1 to verify Previous is shown.
    cleanup();
    showRelative.mockClear();
    const view2 = render(
      <FullImagePreview
        previewState={{ photos: ["a", "b"], index: 1 }}
        previewDragOffset={0}
        previewSwipeOffset={0}
        close={close}
        showRelative={showRelative}
        onPointerDown={vi.fn() as any}
        onPointerMove={vi.fn() as any}
        onPointerUp={vi.fn() as any}
        onPointerCancel={vi.fn() as any}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(showRelative).toHaveBeenCalledWith(-1);

    // Close via the X button
    fireEvent.click(within(view2.container).getByRole("button", { name: "×" }));
    expect(close).toHaveBeenCalled();
  });
});
