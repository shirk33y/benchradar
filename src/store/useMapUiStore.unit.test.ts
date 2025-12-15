import { describe, expect, it } from "vitest";

import { useMapUiStore } from "./useMapUiStore";

describe("useMapUiStore (unit)", () => {
  it("has expected initial state", () => {
    const state = useMapUiStore.getState();
    expect(state.isMenuOpen).toBe(false);
    expect(state.isAddOpen).toBe(false);
    expect(state.addMode).toBe("idle");
    expect(state.authMode).toBe("closed");
  });

  it("setMenuOpen closes add when opening menu", () => {
    useMapUiStore.setState({ isAddOpen: true, isMenuOpen: false });
    useMapUiStore.getState().setMenuOpen(true);

    const state = useMapUiStore.getState();
    expect(state.isMenuOpen).toBe(true);
    expect(state.isAddOpen).toBe(false);
  });

  it("setAddOpen closes menu when opening add", () => {
    useMapUiStore.setState({ isAddOpen: false, isMenuOpen: true });
    useMapUiStore.getState().setAddOpen(true);

    const state = useMapUiStore.getState();
    expect(state.isAddOpen).toBe(true);
    expect(state.isMenuOpen).toBe(false);
  });

  it("toggleMenu toggles open state and preserves add when closing menu", () => {
    useMapUiStore.setState({ isMenuOpen: false, isAddOpen: true });

    useMapUiStore.getState().toggleMenu();
    expect(useMapUiStore.getState().isMenuOpen).toBe(true);
    expect(useMapUiStore.getState().isAddOpen).toBe(false);

    // when closing, add should remain whatever it currently is (false)
    useMapUiStore.getState().toggleMenu();
    expect(useMapUiStore.getState().isMenuOpen).toBe(false);
    expect(useMapUiStore.getState().isAddOpen).toBe(false);
  });

  it("toggleAdd toggles open state and preserves menu when closing add", () => {
    useMapUiStore.setState({ isAddOpen: false, isMenuOpen: true });

    useMapUiStore.getState().toggleAdd();
    expect(useMapUiStore.getState().isAddOpen).toBe(true);
    expect(useMapUiStore.getState().isMenuOpen).toBe(false);

    useMapUiStore.getState().toggleAdd();
    expect(useMapUiStore.getState().isAddOpen).toBe(false);
    expect(useMapUiStore.getState().isMenuOpen).toBe(false);
  });
});
