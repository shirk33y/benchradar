import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { HamburgerMenu } from "./HamburgerMenu";
import { useMapStore } from "../../store/useMapStore";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

beforeEach(() => {
  navigateMock.mockReset();
  useMapStore.setState({
    isMenuOpen: false,
    user: null,
    isAdmin: false,
    openSignIn: vi.fn(),
    handleSignOut: vi.fn(async () => {}),
    setMenuOpen: useMapStore.getState().setMenuOpen,
    toggleMenu: useMapStore.getState().toggleMenu,
  } as any);
});

afterEach(() => {
  cleanup();
});

describe("HamburgerMenu (unit)", () => {
  it("opens menu when hamburger clicked", () => {
    render(<HamburgerMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(useMapStore.getState().isMenuOpen).toBe(true);
  });

  it("shows sign-in action when signed out and calls openSignIn", () => {
    const openSignIn = vi.fn();
    useMapStore.setState({ openSignIn } as any);

    render(<HamburgerMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(openSignIn).toHaveBeenCalled();
  });

  it("navigates to /admin when admin panel clicked", () => {
    useMapStore.setState({
      user: { id: "u1", email: "u1@example.com" } as any,
      isAdmin: true,
    } as any);

    render(<HamburgerMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Admin panel" }));

    expect(navigateMock).toHaveBeenCalledWith("/admin");
  });
});
