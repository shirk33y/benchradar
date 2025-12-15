import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../store/useMapUiStore", () => ({
  useMapUiStore: () => ({
    setAuthMode: vi.fn(),
    setMenuOpen: vi.fn(),
  }),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
      signInWithOAuth: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({})),
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }) }),
    })),
  },
}));

import { useMapAuth } from "./useMapAuth";

describe("useMapAuth (unit)", () => {
  it("openSignIn resets auth form state", () => {
    const { result } = renderHook(() => useMapAuth());

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
