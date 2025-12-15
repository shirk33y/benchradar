import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

import { AdminPage } from "./AdminPage";
import { useAdminStore } from "../store/useAdminStore";
import {
  updateBenchStatus,
  deleteBenchPhotosByUrls,
  deleteBench,
} from "../repositories/benchRepository";

const navigateMock = vi.fn();
let routeTabKey: string | undefined;

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({ tabKey: routeTabKey }),
}));

vi.mock("../components/bench/BenchEditorForm", () => ({
  BenchEditorForm: () => null,
}));

vi.mock("../hooks/useBenchEditorController", () => ({
  useBenchEditorController: () => ({
    editingBench: null,
    startEditingBench: vi.fn(),
    resetEditor: vi.fn(),
    handleFilesSelected: vi.fn(),
    handleLocationInputChange: vi.fn(),
    handleLocationInputBlur: vi.fn(),
    handleRemoveExistingPhoto: vi.fn(),
    pendingFileList: [],
    dragFromIndexRef: { current: null },
    movePhoto: vi.fn(),
    removePhoto: vi.fn(),
    locationInput: "",
    locationInputError: null,
    existingPhotoUrls: [],
    draftDescription: "",
    setDraftDescription: vi.fn(),
    handleEditSubmit: vi.fn(),
    isSubmitting: false,
    submitError: null,
  }),
}));

vi.mock("../repositories/authRepository", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "u1", email: "u1@example.com" })),
}));

vi.mock("../repositories/benchRepository", () => ({
  fetchUserRole: vi.fn(async () => ({ role: "admin", error: null })),
  fetchBenchesForAdminTab: vi.fn(async () => ({
    data: [
      {
        id: "b1",
        latitude: 1,
        longitude: 2,
        title: null,
        description: "Bench 1",
        main_photo_url: null,
        status: "pending",
        created_by: "u1",
        created_at: "2025-01-01T00:00:00.000Z",
        bench_photos: [],
      },
    ],
    error: null,
  })),
  updateBenchStatus: vi.fn(async () => ({ error: null })),
  deleteBenchPhotosByUrls: vi.fn(async () => ({ error: null })),
  deleteBench: vi.fn(async () => ({ error: null })),
}));

beforeEach(() => {
  navigateMock.mockReset();
  routeTabKey = undefined;
  useAdminStore.getState().actions.reset();
  vi.spyOn(window, "confirm").mockImplementation(() => true);
  vi.spyOn(window, "alert").mockImplementation(() => {});

  vi.mocked(updateBenchStatus).mockReset().mockResolvedValue({ error: null } as any);
  vi.mocked(deleteBenchPhotosByUrls).mockReset().mockResolvedValue({ error: null } as any);
  vi.mocked(deleteBench).mockReset().mockResolvedValue({ error: null } as any);

  (globalThis as any).IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
    constructor() {}
  };
});

afterEach(() => {
  cleanup();
});

describe("AdminPage (unit)", () => {
  it("renders benches for the active tab when user is admin", async () => {
    render(<AdminPage />);

    expect(await screen.findByText("Bench 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "NEW" })).toBeInTheDocument();
  });

  it("navigates when tab button clicked", async () => {
    render(<AdminPage />);

    await screen.findByText("Bench 1");

    fireEvent.click(screen.getByRole("button", { name: "REJECTED" }));
    expect(navigateMock).toHaveBeenCalledWith("/admin/rejected");
  });

  it("alerts and keeps bench when status update fails", async () => {
    vi.mocked(updateBenchStatus).mockResolvedValueOnce({ error: "update failed" } as any);

    render(<AdminPage />);

    expect(await screen.findByText("Bench 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve bench" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("update failed");
    });
    expect(screen.getByText("Bench 1")).toBeInTheDocument();
  });

  it("alerts and does not delete bench when photo deletion fails", async () => {
    routeTabKey = "rejected";
    vi.mocked(deleteBenchPhotosByUrls).mockResolvedValueOnce({ error: "photo delete failed" } as any);

    render(<AdminPage />);

    expect(await screen.findByText("Bench 1")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "REJECTED" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Delete bench" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("photo delete failed");
    });
    expect(deleteBench).not.toHaveBeenCalled();
    expect(screen.getByText("Bench 1")).toBeInTheDocument();
  });
});
