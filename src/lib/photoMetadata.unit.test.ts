import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("exifr", () => ({
  gps: vi.fn(),
  parse: vi.fn(),
}));

import * as exifr from "exifr";
import { extractGpsFromFiles } from "./photoMetadata";

describe("photoMetadata (unit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns first gps coords from exifr.gps", async () => {
    (exifr.gps as any).mockResolvedValueOnce({ latitude: 1.1, longitude: 2.2 });

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const coords = await extractGpsFromFiles([file]);

    expect(coords).toEqual([1.1, 2.2]);
  });

  it("falls back to exifr.parse when gps throws", async () => {
    (exifr.gps as any).mockRejectedValueOnce(new Error("no gps"));
    (exifr.parse as any).mockResolvedValueOnce({ latitude: 10, longitude: 20 });

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const coords = await extractGpsFromFiles([file]);

    expect(coords).toEqual([10, 20]);
  });

  it("returns null when no file has coords", async () => {
    (exifr.gps as any).mockResolvedValueOnce(null);
    (exifr.parse as any).mockResolvedValueOnce(null);

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const coords = await extractGpsFromFiles([file]);

    expect(coords).toBe(null);
  });
});
