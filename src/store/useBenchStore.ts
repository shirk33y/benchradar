import create from "zustand";

export type Bench = {
  id: string;
  latitude: number;
  longitude: number;
  title?: string | null;
  description?: string | null;
  mainPhotoUrl?: string | null;
  status: "pending" | "approved" | "rejected";
};

export type BenchState = {
  benches: Bench[];
  selectedBenchId: string | null;
  setBenches: (benches: Bench[]) => void;
  selectBench: (benchId: string | null) => void;
};

export const useBenchStore = create<BenchState>(
  (set: (state: Partial<BenchState>) => void) => ({
    benches: [],
    selectedBenchId: null,
    setBenches: (benches) => set({ benches }),
    selectBench: (benchId) => set({ selectedBenchId: benchId }),
  })
);
