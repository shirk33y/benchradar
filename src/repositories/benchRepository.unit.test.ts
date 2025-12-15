import { describe, expect, it, vi } from "vitest";

import { createBenchRepository, canEditBench } from "./benchRepository";

describe("benchRepository (unit)", () => {
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

    const supabase: any = {
      from: (table: string) => {
        if (table === "bench_photos") {
          return { delete: () => ({ eq: eqPhotos }) };
        }
        if (table === "benches") {
          return { delete: () => ({ eq: eqBench }) };
        }
        throw new Error("unexpected table");
      },
    };

    const repo = createBenchRepository(supabase);
    const res = await repo.deleteBench({ benchId: "b1" });

    expect(res.error).toBe(null);
    expect(eqPhotos).toHaveBeenCalledWith("bench_id", "b1");
    expect(eqBench).toHaveBeenCalledWith("id", "b1");
  });

  it("deleteBench returns error if delete fails", async () => {
    const eqPhotos = vi.fn(async () => ({ error: { message: "no" } }));
    const eqBench = vi.fn(async () => ({ error: null }));

    const supabase: any = {
      from: (table: string) => {
        if (table === "bench_photos") {
          return { delete: () => ({ eq: eqPhotos }) };
        }
        if (table === "benches") {
          return { delete: () => ({ eq: eqBench }) };
        }
        throw new Error("unexpected table");
      },
    };

    const repo = createBenchRepository(supabase);
    const res = await repo.deleteBench({ benchId: "b1" });

    expect(res.error).toBe("Deleting bench failed. Please try again.");
  });
});
