import { describe, expect, it } from "vitest";

import { toThumbnailUrl } from "./imageProcessing";

describe("imageProcessing (unit)", () => {
  it("toThumbnailUrl inserts _thumb before extension and preserves query", () => {
    expect(toThumbnailUrl("https://x/y.webp")).toBe("https://x/y_thumb.webp");
    expect(toThumbnailUrl("https://x/y.jpg?token=1")).toBe(
      "https://x/y_thumb.jpg?token=1"
    );
  });

  it("toThumbnailUrl returns original url if there is no extension", () => {
    expect(toThumbnailUrl("https://x/y")).toBe("https://x/y");
  });
});
