import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useFullImagePreview } from "./useFullImagePreview";

describe("useFullImagePreview (unit)", () => {
  it("opens, navigates relative, and closes", () => {
    const { result } = renderHook(() => useFullImagePreview());

    act(() => {
      result.current.open(["a", "b", "c"], 1);
    });

    expect(result.current.previewState?.index).toBe(1);

    act(() => {
      result.current.showRelative(1);
    });
    expect(result.current.previewState?.index).toBe(2);

    act(() => {
      result.current.showRelative(1);
    });
    expect(result.current.previewState?.index).toBe(0);

    act(() => {
      result.current.close();
    });

    expect(result.current.previewState).toBe(null);
  });
});
