import { describe, expect, it } from "vitest";

import { useMapStore } from "./useMapStore";

describe("useMapStore (unit)", () => {
  it("has expected initial state", () => {
    const state = useMapStore.getState();
    expect(state.isMenuOpen).toBe(false);
    expect(state.isAddOpen).toBe(false);
    expect(state.addMode).toBe("idle");
    expect(state.authMode).toBe("closed");
  });

  it("setMenuOpen closes add when opening menu", () => {
    useMapStore.setState({ isAddOpen: true, isMenuOpen: false });
    useMapStore.getState().setMenuOpen(true);

    const state = useMapStore.getState();
    expect(state.isMenuOpen).toBe(true);
    expect(state.isAddOpen).toBe(false);
  });

  it("setAddOpen closes menu when opening add", () => {
    useMapStore.setState({ isAddOpen: false, isMenuOpen: true });
    useMapStore.getState().setAddOpen(true);

    const state = useMapStore.getState();
    expect(state.isAddOpen).toBe(true);
    expect(state.isMenuOpen).toBe(false);
  });

  it("toggleMenu toggles open state and preserves add when closing menu", () => {
    useMapStore.setState({ isMenuOpen: false, isAddOpen: true });

    useMapStore.getState().toggleMenu();
    expect(useMapStore.getState().isMenuOpen).toBe(true);
    expect(useMapStore.getState().isAddOpen).toBe(false);

    // when closing, add should remain whatever it currently is (false)
    useMapStore.getState().toggleMenu();
    expect(useMapStore.getState().isMenuOpen).toBe(false);
    expect(useMapStore.getState().isAddOpen).toBe(false);
  });

  it("toggleAdd toggles open state and preserves menu when closing add", () => {
    useMapStore.setState({ isAddOpen: false, isMenuOpen: true });

    useMapStore.getState().toggleAdd();
    expect(useMapStore.getState().isAddOpen).toBe(true);
    expect(useMapStore.getState().isMenuOpen).toBe(false);

    useMapStore.getState().toggleAdd();
    expect(useMapStore.getState().isAddOpen).toBe(false);
    expect(useMapStore.getState().isMenuOpen).toBe(false);
  });
});
