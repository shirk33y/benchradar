import type { SupabaseClient } from "@supabase/supabase-js";

import type { Bench } from "../store/useBenchStore";

export type BenchRepository = {
  deleteBench: (args: { benchId: string }) => Promise<{ error: string | null }>;
};

export function createBenchRepository(supabase: SupabaseClient): BenchRepository {
  return {
    deleteBench: async ({ benchId }) => {
      const { error: photosError } = await supabase
        .from("bench_photos")
        .delete()
        .eq("bench_id", benchId);

      const { error: benchError } = await supabase
        .from("benches")
        .delete()
        .eq("id", benchId);

      if (photosError || benchError) {
        return { error: "Deleting bench failed. Please try again." };
      }

      return { error: null };
    },
  };
}

export function canEditBench(args: {
  userId: string | null;
  isAdmin: boolean;
  bench: Bench;
}) {
  const { userId, isAdmin, bench } = args;
  if (!userId) return false;
  if (isAdmin) return true;
  if (!bench.createdBy) return false;
  return bench.createdBy === userId;
}
