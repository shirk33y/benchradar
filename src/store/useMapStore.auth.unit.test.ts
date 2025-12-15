import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("../repositories/authRepository", () => ({
  getCurrentUser: vi.fn(async () => null),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
  signInWithGoogle: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({})),
}));

vi.mock("../repositories/benchRepository", () => ({
  fetchUserRole: vi.fn(async () => ({ role: null, error: null })),
}));

import { useMapStore } from "./useMapStore";
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithGoogle,
  signInWithPassword,
  signOut,
} from "../repositories/authRepository";
import { fetchUserRole } from "../repositories/benchRepository";

const getCurrentUserMock = vi.mocked(getCurrentUser);
const onAuthStateChangeMock = vi.mocked(onAuthStateChange);
const signInWithPasswordMock = vi.mocked(signInWithPassword);
const signInWithGoogleMock = vi.mocked(signInWithGoogle);
const signOutMock = vi.mocked(signOut);
const fetchUserRoleMock = vi.mocked(fetchUserRole);

let authHandler: any = null;
let unsubscribeMock: any = null;

describe("useMapStore auth actions (unit)", () => {
  beforeEach(() => {
    authHandler = null;
    unsubscribeMock = null;

    onAuthStateChangeMock.mockImplementation((handler: any) => {
      authHandler = handler;
      unsubscribeMock = vi.fn();
      return { data: { subscription: { unsubscribe: unsubscribeMock } } } as any;
    });

    getCurrentUserMock.mockResolvedValue(null as any);
    fetchUserRoleMock.mockResolvedValue({ role: null, error: null } as any);

    useMapStore.setState({
      user: null,
      isAdmin: false,
      authEmail: "",
      authPassword: "",
      authError: null,
      authLoading: false,
      authMode: "closed",
      isMenuOpen: false,
    } as any);
  });

  afterEach(() => {
    // reset all mocks between tests
    vi.clearAllMocks();
  });

  it("openSignIn clears auth fields, sets authMode=signin, closes menu", () => {
    useMapStore.setState({
      authEmail: "x",
      authPassword: "y",
      authError: "err",
      authMode: "closed",
      isMenuOpen: true,
    } as any);

    useMapStore.getState().openSignIn();

    const s = useMapStore.getState();
    expect(s.authEmail).toBe("");
    expect(s.authPassword).toBe("");
    expect(s.authError).toBe(null);
    expect(s.authMode).toBe("signin");
    expect(s.isMenuOpen).toBe(false);
  });

  it("handleAuthSubmit sets authError on invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    } as any);
    useMapStore.setState({ authEmail: "a", authPassword: "b" } as any);

    await useMapStore.getState().handleAuthSubmit({ preventDefault: vi.fn() } as any);

    const s = useMapStore.getState();
    expect(s.authLoading).toBe(false);
    expect(s.authError).toBe("Invalid email or password.");
  });

  it("handleAuthSubmit stores user and closes auth modal on success", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "u1@example.com" }, session: {} },
      error: null,
    } as any);
    useMapStore.setState({ authEmail: "a", authPassword: "b", authMode: "signin" } as any);

    await useMapStore.getState().handleAuthSubmit({ preventDefault: vi.fn() } as any);

    const s = useMapStore.getState();
    expect(s.user?.id).toBe("u1");
    expect(s.authMode).toBe("closed");
    expect(s.authError).toBe(null);
    expect(s.authLoading).toBe(false);
  });

  it("handleSignOut clears user, isAdmin and closes menu", async () => {
    useMapStore.setState({
      user: { id: "u1" } as any,
      isAdmin: true,
      isMenuOpen: true,
    } as any);

    await useMapStore.getState().handleSignOut();

    expect(signOutMock).toHaveBeenCalled();
    const s = useMapStore.getState();
    expect(s.user).toBe(null);
    expect(s.isAdmin).toBe(false);
    expect(s.isMenuOpen).toBe(false);
  });

  it("initAuth loads current user and sets isAdmin based on role", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ id: "u1" } as any);
    fetchUserRoleMock.mockResolvedValueOnce({ role: "admin", error: null } as any);

    const cleanup = useMapStore.getState().initAuth();
    await Promise.resolve();
    await Promise.resolve();

    expect(useMapStore.getState().user?.id).toBe("u1");
    expect(useMapStore.getState().isAdmin).toBe(true);

    cleanup();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it("initAuth reacts to auth state change and updates isAdmin", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    const cleanup = useMapStore.getState().initAuth();
    await Promise.resolve();

    expect(authHandler).toBeTruthy();

    fetchUserRoleMock.mockResolvedValueOnce({ role: "admin", error: null } as any);
    await authHandler("SIGNED_IN", { user: { id: "u2" } } as any);

    expect(useMapStore.getState().user?.id).toBe("u2");
    expect(useMapStore.getState().isAdmin).toBe(true);

    cleanup();
  });

  it("handleGoogleSignIn sets authError when provider returns error", async () => {
    signInWithGoogleMock.mockResolvedValueOnce({ error: { message: "no" } } as any);

    await useMapStore.getState().handleGoogleSignIn();

    const s = useMapStore.getState();
    expect(s.authError).toBe("Google sign-in failed. Please try again.");
    expect(s.authLoading).toBe(false);
  });

  it("initAuth sets isAdmin=false when role fetch errors", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ id: "u1" } as any);
    fetchUserRoleMock.mockResolvedValueOnce({ role: null, error: "boom" } as any);

    const cleanup = useMapStore.getState().initAuth();
    await Promise.resolve();
    await Promise.resolve();

    expect(useMapStore.getState().user?.id).toBe("u1");
    expect(useMapStore.getState().isAdmin).toBe(false);

    cleanup();
  });
});
