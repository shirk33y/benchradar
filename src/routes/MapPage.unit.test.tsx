import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";

import { MapPage } from "./MapPage";
import { useBenchStore } from "../store/useBenchStore";
import { useMapUiStore } from "../store/useMapUiStore";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../components/map/MapHeader", () => ({
  MapHeader: () => null,
}));

vi.mock("../components/map/HamburgerMenu", () => ({
  HamburgerMenu: () => null,
}));

vi.mock("../components/map/AuthModal", () => ({
  AuthModal: () => null,
}));

vi.mock("../components/map/AddBenchUi", () => ({
  AddBenchUi: ({ mode, canDelete, onDeleteBench }: any) => {
    return (
      <div data-testid="add-bench-ui">
        <div data-testid="add-bench-mode">{mode}</div>
        {canDelete && onDeleteBench ? (
          <button type="button" onClick={onDeleteBench}>
            Delete bench
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock("leaflet", () => ({
  divIcon: (opts: any) => ({ ...opts }),
}));

vi.mock("leaflet-edgebuffer", () => ({}));

vi.mock("react-leaflet-cluster", () => ({
  default: ({ children }: any) => <div data-testid="cluster">{children}</div>,
}));

vi.mock("react-leaflet", async () => {
  const React = await import("react");

  const ctx = React.createContext<any>(null);

  function MapContainer({ children }: any) {
    const map = {
      closePopup: vi.fn(),
      setView: vi.fn(),
      getCenter: () => ({ lat: 1, lng: 2 }),
    };
    return (
      <div data-testid="map">
        <ctx.Provider value={map}>{children}</ctx.Provider>
      </div>
    );
  }

  function useMap() {
    const map = React.useContext(ctx);
    if (!map) throw new Error("useMap used outside MapContainer");
    return map;
  }

  function TileLayer() {
    return null;
  }

  function Popup({ children }: any) {
    return <div data-testid="popup">{children}</div>;
  }

  function Marker({ title, children }: any) {
    const [open, setOpen] = React.useState(false);
    return (
      <div>
        <button
          type="button"
          data-testid="marker"
          aria-label={title}
          onClick={() => setOpen((v) => !v)}
        >
          marker
        </button>
        {open ? children : null}
      </div>
    );
  }

  return { MapContainer, TileLayer, Marker, Popup, useMap };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "u1@example.com" } } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn(async () => ({ data: null })),
            }),
          }),
        };
      }

      if (table === "bench_photos" || table === "benches") {
        return {
          delete: () => ({
            eq: vi.fn(async () => ({ error: null })),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }),
        }),
      };
    }),
  },
}));

vi.mock("./mapBenches", () => ({
  fetchBenchesWithPhotos: vi.fn(async () => [
    {
      id: "b1",
      latitude: 1,
      longitude: 2,
      description: "Bench 1",
      status: "approved",
      createdBy: "u1",
      photoUrls: [
        "https://example.com/p1.jpg",
        "https://example.com/p2.jpg",
        "https://example.com/p3.jpg",
        "https://example.com/p4.jpg",
        "https://example.com/p5.jpg",
      ],
      mainPhotoUrl: "https://example.com/p1.jpg",
    },
  ]),
}));

function resetStores() {
  useBenchStore.setState({ benches: [], selectedBenchId: null });
  useMapUiStore.setState({
    isMenuOpen: false,
    isAddOpen: false,
    addMode: "idle",
    authMode: "closed",
  } as any);
}

beforeEach(() => {
  resetStores();
  vi.spyOn(window, "confirm").mockImplementation(() => true);
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  resetStores();
});

describe("MapPage (unit)", () => {
  it("opens a popup with correct bench data when marker clicked", async () => {
    render(<MapPage />);

    const marker = await screen.findByTestId("marker");
    fireEvent.click(marker);

    expect(await screen.findByText("Bench 1")).toBeInTheDocument();
  });

  it("popup thumbnails can be scrolled via wheel", async () => {
    render(<MapPage />);

    fireEvent.click(await screen.findByTestId("marker"));

    // The gallery has className "popup-gallery"; query it directly.
    const popup = screen.getByTestId("popup");
    const popupGallery = popup.querySelector(".popup-gallery") as HTMLElement;
    expect(popupGallery).toBeTruthy();

    // JSDOM doesn't implement scrollBy; MapPage checks for it.
    (popupGallery as any).scrollBy = vi.fn();

    fireEvent.wheel(popupGallery, { deltaX: 120, deltaY: 0 });
    expect((popupGallery as any).scrollBy).toHaveBeenCalled();
  });

  it("opens full image preview from thumbnail; supports Arrow nav + close", async () => {
    render(<MapPage />);

    fireEvent.click(await screen.findByTestId("marker"));

    const popup = screen.getByTestId("popup");
    const thumbs = within(popup).getAllByRole("button");
    // First thumbnail button opens preview
    fireEvent.click(thumbs[0]);

    expect(await screen.findByAltText("Bench preview")).toBeInTheDocument();
    expect(screen.getByText("1/5")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("2/5")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByText("1/5")).toBeInTheDocument();

    // Close with Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByAltText("Bench preview")).not.toBeInTheDocument();
  });

  it("deletes a bench via Edit -> Delete bench", async () => {
    render(<MapPage />);

    fireEvent.click(await screen.findByTestId("marker"));

    const popup = screen.getByTestId("popup");
    const editButton = within(popup).getByRole("button", { name: "Edit" });
    fireEvent.click(editButton);

    // When editingBench is set, MapPage passes canDelete/onDeleteBench to AddBenchUi.
    const deleteBtn = await screen.findByRole("button", { name: "Delete bench" });
    fireEvent.click(deleteBtn);

    const { supabase } = await import("../lib/supabaseClient");
    expect((supabase.from as any)).toHaveBeenCalledWith("bench_photos");
    expect((supabase.from as any)).toHaveBeenCalledWith("benches");

    await waitFor(() => {
      expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
    });
  });
});
