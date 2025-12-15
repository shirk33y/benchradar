import { describe, expect, it } from "vitest";

import { useBenchStore } from "./useBenchStore";

describe("useBenchStore (unit)", () => {
  it("has expected initial state", () => {
    const state = useBenchStore.getState();
    expect(state.benches).toEqual([]);
    expect(state.selectedBenchId).toBe(null);
  });

  it("setBenches replaces benches and selectBench sets selectedBenchId", () => {
    useBenchStore.getState().setBenches([
      {
        id: "b1",
        latitude: 1,
        longitude: 2,
        status: "approved",
      },
    ] as any);

    expect(useBenchStore.getState().benches.map((b) => b.id)).toEqual(["b1"]);

    useBenchStore.getState().selectBench("b1");
    expect(useBenchStore.getState().selectedBenchId).toBe("b1");

    useBenchStore.getState().selectBench(null);
    expect(useBenchStore.getState().selectedBenchId).toBe(null);
  });
});
