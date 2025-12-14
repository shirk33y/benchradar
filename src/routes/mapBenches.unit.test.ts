import { describe, expect, it } from "vitest";
import { fetchBenchesWithPhotos } from "./mapBenches";

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

describe("fetchBenchesWithPhotos (unit)", () => {
  it("returns benches used for markers (descriptions preserved)", async () => {
    const supabase = makeSupabaseMock([
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

    const benches = await fetchBenchesWithPhotos(supabase);
    expect(benches.map((b) => b.description)).toEqual(["it-seed-1", "it-seed-2"]);
  });

  it("refetch can include a far bench (analogous to panning in e2e)", async () => {
    const supabase = makeSupabaseMock([
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

    const first = await fetchBenchesWithPhotos(supabase);
    expect(first.map((b) => b.description)).toEqual(["it-seed-1"]);

    const second = await fetchBenchesWithPhotos(supabase);
    expect(second.map((b) => b.description)).toContain("it-seed-far");
  });
});
