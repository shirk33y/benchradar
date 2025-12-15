import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../store/useMapStore", () => ({
  useMapStore: () => ({
    setAuthMode: vi.fn(),
    setMenuOpen: vi.fn(),
  }),
}));

vi.mock("../repositories/benchRepository", () => ({
  fetchUserRole: vi.fn(async () => ({ role: null, error: null })),
}));

vi.mock("../repositories/authRepository", () => ({
  getCurrentUser: vi.fn(async () => null),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
  signInWithGoogle: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({})),
}));

import { useAuth } from "./useAuth";

describe("useAuth (unit)", () => {
  it("openSignIn resets auth form state", () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.setAuthEmail("x");
      result.current.setAuthPassword("y");
    });

    act(() => {
      result.current.openSignIn();
    });

    expect(result.current.authEmail).toBe("");
    expect(result.current.authPassword).toBe("");
  });
});
