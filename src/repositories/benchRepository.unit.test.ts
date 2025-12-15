import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

import { supabase } from "../lib/supabaseClient";
import {
  canEditBench,
  deleteBench,
  fetchBenchesWithPhotos,
  uploadPendingBenchPhotos,
} from "./benchRepository";

vi.mock("../lib/imageProcessing", () => ({
  convertToWebp: vi.fn(async () => new File(["x"], "out.webp")),
}));

function makeSupabaseMock(responses: {
  benches: any;
  photos?: any;
}[]) {
  let call = 0;

  return {
    from: (table: string) => {
      const current = responses[Math.min(call, responses.length - 1)];
      if (table === "benches") {
        const chain: any = {
          select: () => chain,
          neq: async () => {
            return current.benches;
          },
        };
        return chain;
      }

      if (table === "bench_photos") {
        const chain: any = {
          select: () => chain,
          in: async () => {
            return current.photos ?? { data: [], error: null };
          },
        };
        call += 1;
        return chain;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("benchRepository (unit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uploadPendingBenchPhotos returns urls for successful uploads", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("id-1" as any);

    const uploadLarge = vi.fn(async () => ({ error: null }));
    const uploadThumb = vi.fn(async () => ({ error: null }));
    const getPublicUrl = vi
      .fn()
      .mockReturnValueOnce({ data: { publicUrl: "u1" } })
      .mockReturnValueOnce({ data: { publicUrl: "u2" } });

    (supabase.storage.from as any).mockReturnValue({
      upload: vi.fn((path: string) => {
        if (path.endsWith("_thumb.webp")) return uploadThumb();
        return uploadLarge();
      }),
      getPublicUrl,
    });

    const f1 = new File(["a"], "a.jpg");
    const f2 = new File(["b"], "b.jpg");

    const res = await uploadPendingBenchPhotos({ ownerId: "o1", files: [f1, f2] });
    expect(res).toEqual({ urls: ["u1", "u2"], error: null });
  });

  it("uploadPendingBenchPhotos returns error when an upload fails", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("id-1" as any);

    (supabase.storage.from as any).mockReturnValue({
      upload: vi.fn(async () => ({ error: { message: "no" } })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "u1" } })),
    });

    const f1 = new File(["a"], "a.jpg");
    const res = await uploadPendingBenchPhotos({ ownerId: "o1", files: [f1] });

    expect(res.urls).toEqual([]);
    expect(res.error).toBe("Uploading photos failed. Please try again.");
  });

  it("canEditBench allows admin or owner", () => {
    const bench: any = { createdBy: "u1" };

    expect(canEditBench({ userId: null, isAdmin: false, bench })).toBe(false);
    expect(canEditBench({ userId: "u2", isAdmin: false, bench })).toBe(false);
    expect(canEditBench({ userId: "u1", isAdmin: false, bench })).toBe(true);
    expect(canEditBench({ userId: "any", isAdmin: true, bench })).toBe(true);
  });

  it("deleteBench deletes photos then bench", async () => {
    const eqPhotos = vi.fn(async () => ({ error: null }));
    const eqBench = vi.fn(async () => ({ error: null }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "bench_photos") {
        return { delete: () => ({ eq: eqPhotos }) };
      }
      if (table === "benches") {
        return { delete: () => ({ eq: eqBench }) };
      }
      throw new Error("unexpected table");
    });

    const res = await deleteBench({ benchId: "b1" });

    expect(res.error).toBe(null);
    expect(eqPhotos).toHaveBeenCalledWith("bench_id", "b1");
    expect(eqBench).toHaveBeenCalledWith("id", "b1");
  });

  it("deleteBench returns error if delete fails", async () => {
    const eqPhotos = vi.fn(async () => ({ error: { message: "no" } }));
    const eqBench = vi.fn(async () => ({ error: null }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "bench_photos") {
        return { delete: () => ({ eq: eqPhotos }) };
      }
      if (table === "benches") {
        return { delete: () => ({ eq: eqBench }) };
      }
      throw new Error("unexpected table");
    });

    const res = await deleteBench({ benchId: "b1" });

    expect(res.error).toBe("Deleting bench failed. Please try again.");
  });

  it("fetchBenchesWithPhotos returns [] on benches error", async () => {
    const neq = vi.fn(async () => ({ data: null, error: { message: "no" } }));
    (supabase.from as any).mockImplementation((table: string) => {
      if (table !== "benches") throw new Error("unexpected table");
      return { select: () => ({ neq }) };
    });

    const benches = await fetchBenchesWithPhotos();
    expect(benches).toEqual([]);
  });

  it("fetchBenchesWithPhotos orders photos with is_main first and filters null urls", async () => {
    const neq = vi.fn(async () => ({
      data: [
        {
          id: "b1",
          latitude: 1,
          longitude: 2,
          title: null,
          description: null,
          main_photo_url: "https://example.com/main.webp",
          status: "approved",
          created_by: null,
        },
      ],
      error: null,
    }));

    const inFn = vi.fn(async () => ({
      data: [
        { bench_id: "b1", url: "https://example.com/p2.webp", is_main: false },
        { bench_id: "b1", url: "https://example.com/p1.webp", is_main: true },
        { bench_id: "b1", url: null, is_main: false },
      ],
      error: null,
    }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "benches") {
        return { select: () => ({ neq }) };
      }
      if (table === "bench_photos") {
        return { select: () => ({ in: inFn }) };
      }
      throw new Error("unexpected table");
    });

    const benches = await fetchBenchesWithPhotos();
    expect(benches[0].photoUrls).toEqual([
      "https://example.com/p1.webp",
      "https://example.com/p2.webp",
    ]);
  });

  it("fetchBenchesWithPhotos preserves descriptions", async () => {
    const mock = makeSupabaseMock([
      {
        benches: {
          data: [
            {
              id: "b1",
              latitude: 1,
              longitude: 2,
              title: null,
              description: "it-seed-1",
              main_photo_url: null,
              status: "approved",
              created_by: null,
            },
            {
              id: "b2",
              latitude: 3,
              longitude: 4,
              title: null,
              description: "it-seed-2",
              main_photo_url: null,
              status: "approved",
              created_by: null,
            },
          ],
          error: null,
        },
        photos: { data: [], error: null },
      },
    ]);

    (supabase.from as any).mockImplementation(mock.from);
    const benches = await fetchBenchesWithPhotos();
    expect(benches.map((b) => b.description)).toEqual(["it-seed-1", "it-seed-2"]);
  });

  it("fetchBenchesWithPhotos can include a far bench on refetch", async () => {
    const mock = makeSupabaseMock([
      {
        benches: {
          data: [
            {
              id: "b1",
              latitude: 1,
              longitude: 2,
              title: null,
              description: "it-seed-1",
              main_photo_url: null,
              status: "approved",
              created_by: null,
            },
          ],
          error: null,
        },
      },
      {
        benches: {
          data: [
            {
              id: "b1",
              latitude: 1,
              longitude: 2,
              title: null,
              description: "it-seed-1",
              main_photo_url: null,
              status: "approved",
              created_by: null,
            },
            {
              id: "b3",
              latitude: 50,
              longitude: 60,
              title: null,
              description: "it-seed-far",
              main_photo_url: null,
              status: "approved",
              created_by: null,
            },
          ],
          error: null,
        },
      },
    ]);

    (supabase.from as any).mockImplementation(mock.from);

    const first = await fetchBenchesWithPhotos();
    expect(first.map((b) => b.description)).toEqual(["it-seed-1"]);

    const second = await fetchBenchesWithPhotos();
    expect(second.map((b) => b.description)).toContain("it-seed-far");
  });
});
