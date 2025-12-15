import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { AuthModal } from "./AuthModal";
import { useMapStore } from "../../store/useMapStore";

beforeEach(() => {
  useMapStore.setState({
    authMode: "closed",
    authEmail: "",
    authPassword: "",
    authError: null,
    authLoading: false,
    setAuthMode: useMapStore.getState().setAuthMode,
    setAuthEmail: useMapStore.getState().setAuthEmail,
    setAuthPassword: useMapStore.getState().setAuthPassword,
    handleAuthSubmit: vi.fn(async () => {}),
    handleGoogleSignIn: vi.fn(async () => {}),
  } as any);
});

afterEach(() => {
  cleanup();
});

describe("AuthModal (unit)", () => {
  it("does not render when authMode is closed", () => {
    render(<AuthModal />);
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("renders when authMode is signin and closes on backdrop click", () => {
    useMapStore.setState({ authMode: "signin" } as any);

    const setAuthMode = vi.fn();
    useMapStore.setState({ setAuthMode } as any);

    const view = render(<AuthModal />);

    // there are multiple "Sign in" texts (header + submit button)
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();

    // backdrop is the outermost element rendered by AuthModal
    fireEvent.click(view.container.firstElementChild as HTMLElement);

    expect(setAuthMode).toHaveBeenCalledWith("closed");
  });

  it("calls handleGoogleSignIn when Google button clicked", () => {
    useMapStore.setState({ authMode: "signin" } as any);

    const handleGoogleSignIn = vi.fn(async () => {});
    useMapStore.setState({ handleGoogleSignIn } as any);

    render(<AuthModal />);

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/i }));
    expect(handleGoogleSignIn).toHaveBeenCalled();
  });

  it("submits via handleAuthSubmit when Sign in button clicked", () => {
    useMapStore.setState({ authMode: "signin" } as any);

    const handleAuthSubmit = vi.fn(async () => {});
    useMapStore.setState({ handleAuthSubmit } as any);

    const view = render(<AuthModal />);

    const form = view.container.querySelector("form") as HTMLFormElement;
    expect(form).toBeTruthy();
    fireEvent.submit(form);
    expect(handleAuthSubmit).toHaveBeenCalled();
  });

  it("renders authError message", () => {
    useMapStore.setState({ authMode: "signin", authError: "Bad creds" } as any);

    render(<AuthModal />);
    expect(screen.getByText("Bad creds")).toBeInTheDocument();
  });

  it("close button sets authMode closed", () => {
    useMapStore.setState({ authMode: "signin" } as any);

    const setAuthMode = vi.fn();
    useMapStore.setState({ setAuthMode } as any);

    render(<AuthModal />);
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(setAuthMode).toHaveBeenCalledWith("closed");
  });
});
