import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLngExpression } from "leaflet";
import { useNavigate, useParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabaseClient";
import type { Bench } from "../store/useBenchStore";
import { convertToWebp } from "../lib/imageProcessing";
import {
  LAT_LNG_HINT,
  formatLatLngInput,
  parseLatLngInput,
} from "../lib/geo";
import { BenchEditorForm } from "../components/bench/BenchEditorForm";

type BenchPhotoRow = { url: string; is_main: boolean | null };

type BenchAdminRow = Bench & {
  createdBy: string;
  createdAt: string;
  photoUrls: string[];
};

type TabKey = "pending" | "rejected" | "approved";

type TabState = {
  items: BenchAdminRow[];
  loading: boolean;
  loadingMore: boolean;
  initialized: boolean;
  endReached: boolean;
  lastCursor: string | null;
};

const TAB_KEYS = ["pending", "rejected", "approved"] as const;

function isTabKey(value: string | undefined): value is TabKey {
  if (!value) return false;
  return (TAB_KEYS as readonly string[]).includes(value);
}

const TAB_CONFIG: Record<
  TabKey,
  { label: string; accent: string; empty: string }
> = {
  pending: {
    label: "NEW",
    accent: "from-amber-500/10 via-amber-300/60 to-transparent",
    empty: "No new benches",
  },
  rejected: {
    label: "REJECTED",
    accent: "from-rose-500/10 via-rose-300/60 to-transparent",
    empty: "No rejected benches",
  },
  approved: {
    label: "APPROVED",
    accent: "from-emerald-500/10 via-emerald-300/60 to-transparent",
    empty: "No approved benches",
  },
};

const PAGE_SIZE = 12;

function createInitialTabState(): TabState {
  return {
    items: [],
    loading: false,
    loadingMore: false,
    initialized: false,
    endReached: false,
    lastCursor: null,
  };
}

export function AdminPage() {
  const params = useParams<{ tabKey?: string }>();
  const initialRouteTab = isTabKey(params.tabKey) ? params.tabKey : "pending";
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(initialRouteTab);
  const [tabState, setTabState] = useState<Record<TabKey, TabState>>({
    pending: createInitialTabState(),
    rejected: createInitialTabState(),
    approved: createInitialTabState(),
  });
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      setUser(user ?? null);

      if (!user) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError("Fetching profile failed.");
        setAuthLoading(false);
        return;
      }

      const admin = profile?.role === "admin";

      if (cancelled) return;

      setIsAdmin(admin);
      setAuthLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadTabPage = useCallback(
    async (tab: TabKey) => {
      const state = tabState[tab];
      if (state.loading || state.loadingMore || state.endReached) return;

      const isInitial = !state.initialized;

      setTabState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          loading: isInitial,
          loadingMore: !isInitial,
        },
      }));

      let query = supabase
        .from("benches")
        .select(
          "id, latitude, longitude, title, description, main_photo_url, status, created_by, created_at, bench_photos(url, is_main)"
        )
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (state.lastCursor) {
        query = query.lt("created_at", state.lastCursor);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError("Loading benches failed.");
        setTabState((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            loading: false,
            loadingMore: false,
          },
        }));
        return;
      }

      const mapped: BenchAdminRow[] =
        data?.map((row) => {
          const photos = (row.bench_photos as BenchPhotoRow[] | null) ?? [];
          const sortedPhotos = [...photos].sort((a, b) => {
            if (a.is_main && !b.is_main) return -1;
            if (!a.is_main && b.is_main) return 1;
            return 0;
          });
          const photoUrls =
            sortedPhotos.length > 0
              ? sortedPhotos.map((p) => p.url)
              : row.main_photo_url
              ? [row.main_photo_url]
              : [];
          return {
            id: row.id,
            latitude: row.latitude,
            longitude: row.longitude,
            title: row.title,
            description: row.description,
            mainPhotoUrl: row.main_photo_url,
            status: row.status as Bench["status"],
            createdBy: row.created_by,
            createdAt: row.created_at,
            photoUrls,
          };
        }) ?? [];

      setTabState((prev) => {
        const prevTab = prev[tab];
        const merged = isInitial ? mapped : [...prevTab.items, ...mapped];
        return {
          ...prev,
          [tab]: {
            ...prevTab,
            items: merged,
            loading: false,
            loadingMore: false,
            initialized: true,
            lastCursor:
              mapped.length > 0
                ? mapped[mapped.length - 1].createdAt
                : prevTab.lastCursor,
            endReached: mapped.length < PAGE_SIZE,
          },
        };
      });
    },
    [tabState]
  );

  const activeTabState = tabState[activeTab];
  const pendingState = tabState.pending;

  useEffect(() => {
    if (!isAdmin) return;
    if (
      pendingState.initialized ||
      pendingState.loading ||
      pendingState.loadingMore
    ) {
      return;
    }
    loadTabPage("pending");
  }, [
    isAdmin,
    loadTabPage,
    pendingState.initialized,
    pendingState.loading,
    pendingState.loadingMore,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (
      activeTabState.initialized ||
      activeTabState.loading ||
      activeTabState.loadingMore ||
      activeTab === "pending"
    ) {
      return;
    }
    loadTabPage(activeTab);
  }, [
    activeTab,
    activeTabState.initialized,
    activeTabState.loading,
    activeTabState.loadingMore,
    isAdmin,
    loadTabPage,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!activeTabState.initialized) return;
    if (activeTabState.endReached) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (
          entry.isIntersecting &&
          !activeTabState.loading &&
          !activeTabState.loadingMore &&
          !activeTabState.endReached
        ) {
          loadTabPage(activeTab);
        }
      },
      { rootMargin: "200px 0px 0px 0px" }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    activeTab,
    activeTabState.endReached,
    activeTabState.initialized,
    activeTabState.loading,
    activeTabState.loadingMore,
    isAdmin,
    loadTabPage,
  ]);

  const removeBenchFromTabs = useCallback((benchId: string) => {
    setTabState((prev) => {
      let changed = false;
      const next: Record<TabKey, TabState> = { ...prev };
      (Object.keys(prev) as TabKey[]).forEach((tab) => {
        const exists = prev[tab].items.some((b) => b.id === benchId);
        if (exists) {
          changed = true;
          next[tab] = {
            ...prev[tab],
            items: prev[tab].items.filter((b) => b.id !== benchId),
          };
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const insertBenchIntoTab = useCallback(
    (bench: BenchAdminRow, tab: TabKey) => {
      setTabState((prev) => {
        const current = prev[tab];
        if (!current.initialized) {
          return prev;
        }
        return {
          ...prev,
          [tab]: {
            ...current,
            items: [bench, ...current.items],
          },
        };
      });
    },
    []
  );

  const updateBenchInTabs = useCallback(
    (benchId: string, updater: (bench: BenchAdminRow) => BenchAdminRow) => {
      setTabState((prev) => {
        let changed = false;
        const next: Record<TabKey, TabState> = { ...prev };

        (Object.keys(prev) as TabKey[]).forEach((tab) => {
          const idx = prev[tab].items.findIndex((b) => b.id === benchId);
          if (idx !== -1) {
            changed = true;
            const updatedBench = updater(prev[tab].items[idx]);
            const newItems = [...prev[tab].items];
            newItems[idx] = updatedBench;
            next[tab] = { ...prev[tab], items: newItems };
          }
        });

        return changed ? next : prev;
      });
    },
    []
  );

  const handleChangeStatus = async (
    bench: BenchAdminRow,
    status: Bench["status"]
  ) => {
    const { error: updateError } = await supabase
      .from("benches")
      .update({ status })
      .eq("id", bench.id);

    if (updateError) {
      window.alert("Updating status failed. Please try again.");
      return;
    }

    removeBenchFromTabs(bench.id);
    insertBenchIntoTab({ ...bench, status }, status);
  };

  const handleDeleteBench = async (bench: BenchAdminRow) => {
    const confirmDelete = window.confirm(
      "Delete this bench permanently? This cannot be undone."
    );
    if (!confirmDelete) return;

    const { error: photosError } = await supabase
      .from("bench_photos")
      .delete()
      .eq("bench_id", bench.id);

    if (photosError) {
      window.alert("Deleting bench photos failed. Please try again.");
      return;
    }

    const { error: benchError } = await supabase
      .from("benches")
      .delete()
      .eq("id", bench.id);

    if (benchError) {
      window.alert("Deleting bench failed. Please try again.");
      return;
    }

    removeBenchFromTabs(bench.id);
  };

  const routeTab = isTabKey(params.tabKey) ? params.tabKey : "pending";

  useEffect(() => {
    if (params.tabKey && !isTabKey(params.tabKey)) {
      navigate("/admin", { replace: true });
    }
  }, [params.tabKey, navigate]);

  useEffect(() => {
    if (activeTab !== routeTab) {
      setActiveTab(routeTab);
    }
  }, [routeTab, activeTab]);

  const [editingBench, setEditingBench] = useState<BenchAdminRow | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [editingLocationInput, setEditingLocationInput] = useState("");
  const [editingLocationDirty, setEditingLocationDirty] = useState(false);
  const [editingLocationError, setEditingLocationError] = useState<
    string | null
  >(null);
  const [editingChosenLocation, setEditingChosenLocation] =
    useState<LatLngExpression | null>(null);
  const [editingPendingFiles, setEditingPendingFiles] = useState<File[]>([]);
  const [editingExistingPhotoUrls, setEditingExistingPhotoUrls] = useState<
    string[]
  >([]);
  const [editingRemovedPhotoUrls, setEditingRemovedPhotoUrls] = useState<
    string[]
  >([]);
  const [editingSubmitError, setEditingSubmitError] = useState<string | null>(
    null
  );
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const editingDragFromIndexRef = useRef<number | null>(null);

  const openEditDialog = (bench: BenchAdminRow) => {
    setEditingBench(bench);
    setEditingDescription(bench.description ?? "");
    setEditingLocationInput(formatLatLngInput(bench.latitude, bench.longitude));
    setEditingLocationDirty(false);
    setEditingLocationError(null);
    setEditingChosenLocation([bench.latitude, bench.longitude]);
    setEditingPendingFiles([]);
    setEditingRemovedPhotoUrls([]);
    setEditingSubmitError(null);
    const initialPhotos =
      bench.photoUrls && bench.photoUrls.length > 0
        ? bench.photoUrls
        : bench.mainPhotoUrl
        ? [bench.mainPhotoUrl]
        : [];
    setEditingExistingPhotoUrls(initialPhotos);
  };

  const closeEditDialog = () => {
    setEditingBench(null);
    setEditingDescription("");
    setEditingLocationInput("");
    setEditingLocationDirty(false);
    setEditingLocationError(null);
    setEditingChosenLocation(null);
    setEditingPendingFiles([]);
    setEditingExistingPhotoUrls([]);
    setEditingRemovedPhotoUrls([]);
    setEditingSubmitError(null);
    setEditingSubmitting(false);
  };

  const handleEditBench = (bench: BenchAdminRow) => {
    openEditDialog(bench);
  };

  const handleEditingFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setEditingPendingFiles((prev) => [...prev, ...incoming]);
  };

  const handleEditingMovePhoto = (fromIndex: number, toIndex: number) => {
    setEditingPendingFiles((current) => {
      if (toIndex < 0 || toIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const removePendingEditPhoto = (index: number) => {
    setEditingPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingEditPhoto = (index: number) => {
    setEditingExistingPhotoUrls((prev) => {
      const clone = [...prev];
      const [removed] = clone.splice(index, 1);
      if (removed) {
        setEditingRemovedPhotoUrls((prevRemoved) => [...prevRemoved, removed]);
      }
      return clone;
    });
  };

  const validateEditingLocation = (value: string): string | null => {
    if (!value.trim()) {
      return LAT_LNG_HINT;
    }
    return parseLatLngInput(value) ? null : "Coordinates must be valid lat,lng";
  };

  const handleEditingLocationChange = (value: string) => {
    if (!editingLocationDirty) {
      setEditingLocationDirty(true);
    }
    setEditingLocationInput(value);
    setEditingLocationError(validateEditingLocation(value));
  };

  const handleEditingLocationBlur = () => {
    if (!editingLocationDirty) {
      setEditingLocationDirty(true);
    }
    const error = validateEditingLocation(editingLocationInput);
    setEditingLocationError(error);
    if (error) {
      return;
    }
    const parsed = parseLatLngInput(editingLocationInput);
    if (!parsed) return;
    const [lat, lng] = parsed;
    setEditingChosenLocation([lat, lng]);
    setEditingLocationInput(formatLatLngInput(lat, lng));
  };

  const handleEditingSubmit = async () => {
    if (!editingBench) return;

    const locationError = validateEditingLocation(editingLocationInput);
    if (locationError) {
      setEditingLocationError(locationError);
      return;
    }

    const parsed = parseLatLngInput(editingLocationInput);
    const [lat, lng] = parsed ?? [
      editingBench.latitude,
      editingBench.longitude,
    ];

    const remainingExisting = editingExistingPhotoUrls;
    const hasExisting = remainingExisting.length > 0;
    const hasNew = editingPendingFiles.length > 0;

    if (!hasExisting && !hasNew) {
      setEditingSubmitError("Add at least one photo.");
      return;
    }

    setEditingSubmitting(true);
    setEditingSubmitError(null);

    try {
      const uploadedUrls: string[] = [];
      let mainPhotoUrl: string | null =
        (editingBench.mainPhotoUrl &&
          remainingExisting.find((url) => url === editingBench.mainPhotoUrl)) ??
        remainingExisting[0] ??
        null;

      if (editingPendingFiles.length > 0) {
        for (const file of editingPendingFiles) {
          const largeWebp = await convertToWebp(file, 900);
          const thumbWebp = await convertToWebp(file, 48);

          const id = crypto.randomUUID();
          const ownerPrefix = editingBench.createdBy || user?.id || "admin";
          const largePath = `${ownerPrefix}/${id}.webp`;
          const thumbPath = `${ownerPrefix}/${id}_thumb.webp`;

          const { error: uploadError } = await supabase.storage
            .from("bench_photos")
            .upload(largePath, largeWebp, {
              contentType: "image/webp",
              upsert: false,
            });

          if (uploadError) {
            setEditingSubmitError(
              "Uploading photos failed. Please try again."
            );
            return;
          }

          await supabase.storage
            .from("bench_photos")
            .upload(thumbPath, thumbWebp, {
              contentType: "image/webp",
              upsert: false,
            });

          const {
            data: { publicUrl },
          } = supabase.storage.from("bench_photos").getPublicUrl(largePath);

          uploadedUrls.push(publicUrl);
        }
      }

      if (!mainPhotoUrl) {
        mainPhotoUrl =
          editingBench.mainPhotoUrl ??
          uploadedUrls[0] ??
          remainingExisting[0] ??
          null;
      }

      const updates: Record<string, unknown> = {
        latitude: lat,
        longitude: lng,
        description: editingDescription || null,
      };

      if (mainPhotoUrl && mainPhotoUrl !== editingBench.mainPhotoUrl) {
        updates.main_photo_url = mainPhotoUrl;
      }

      const { error: benchError } = await supabase
        .from("benches")
        .update(updates)
        .eq("id", editingBench.id);

      if (benchError) {
        setEditingSubmitError("Saving bench failed. Please try again.");
        return;
      }

      if (editingRemovedPhotoUrls.length > 0) {
        await supabase
          .from("bench_photos")
          .delete()
          .eq("bench_id", editingBench.id)
          .in("url", editingRemovedPhotoUrls);
      }

      if (uploadedUrls.length > 0) {
        const photoRows = uploadedUrls.map((url) => ({
          bench_id: editingBench.id,
          url,
          is_main: mainPhotoUrl === url,
        }));

        await supabase.from("bench_photos").insert(photoRows);
      }

      const updatedPhotoUrls = [...remainingExisting, ...uploadedUrls];

      updateBenchInTabs(editingBench.id, (b) => ({
        ...b,
        latitude: lat,
        longitude: lng,
        description: editingDescription || null,
        mainPhotoUrl: mainPhotoUrl ?? b.mainPhotoUrl,
        photoUrls: updatedPhotoUrls,
      }));

      closeEditDialog();
    } finally {
      setEditingSubmitting(false);
    }
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === "pending") {
      navigate("/admin");
    } else {
      navigate(`/admin/${tab}`);
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex h-dvh w-dvw flex-col bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-800/80 bg-slate-900/80 text-slate-50 transition hover:bg-slate-800/90 active:scale-95"
            aria-label="Back to map"
            onClick={() => navigate("/")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold tracking-wide text-sky-200">
            BenchRadar Admin
          </h1>
        </div>
        {user && (
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
            {user.email}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-3 pb-20 pt-3">
        {authLoading && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Loading benches...
          </div>
        )}

        {!authLoading && error && (
          <div className="flex h-full items-center justify-center text-xs text-rose-300">
            {error}
          </div>
        )}

        {!authLoading && !error && !isAdmin && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            You must be an admin to view this screen.
          </div>
        )}

        {!authLoading && !error && isAdmin && (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                {TAB_CONFIG[activeTab].label}
              </h2>
              <span
                className={`h-1 w-16 rounded-full bg-gradient-to-r ${TAB_CONFIG[activeTab].accent}`}
              />
            </div>

            <div className="flex-1 space-y-2">
              {activeTabState.loading && (
                <div className="flex justify-center py-6 text-xs text-slate-400">
                  Loading...
                </div>
              )}

              {!activeTabState.loading &&
                activeTabState.items.map((bench) => (
                  <article
                    key={bench.id}
                    className="relative flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/80 p-3 shadow-lg shadow-slate-950/40 md:flex-row md:items-stretch"
                  >
                    <div className="flex flex-1 flex-col gap-2 pr-28 text-pretty md:pr-0">
                      <div className="text-[11px] leading-snug text-slate-100 break-words">
                        {bench.description || (
                          <span className="text-slate-500">No description</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                        <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-200">
                          {bench.createdBy.slice(0, 10)}…
                        </span>
                        <span>
                          {bench.latitude.toFixed(4)}, {bench.longitude.toFixed(4)}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Submitted {new Date(bench.createdAt).toLocaleString()}
                      </div>
                      {bench.photoUrls && bench.photoUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {bench.photoUrls.map((url) => (
                            <div
                              key={url}
                              className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 shadow"
                            >
                              <img
                                src={url}
                                alt="Bench"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="absolute right-3 top-3 flex gap-2">
                      <button
                        type="button"
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/90 text-lg font-semibold text-slate-100 shadow-inner shadow-slate-900/40 transition active:scale-[0.97]"
                        onClick={() => handleEditBench(bench)}
                        aria-label="Edit details"
                      >
                        ✎
                      </button>
                      {activeTab === "pending" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/90 text-lg font-semibold text-slate-900 shadow-inner shadow-emerald-900/20 transition active:scale-[0.97]"
                            onClick={() => handleChangeStatus(bench, "approved")}
                            aria-label="Approve bench"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/90 text-lg font-semibold text-white shadow-inner shadow-rose-900/30 transition active:scale-[0.97]"
                            onClick={() => handleChangeStatus(bench, "rejected")}
                            aria-label="Reject bench"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {activeTab === "rejected" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/90 text-lg font-semibold text-slate-900 shadow-inner shadow-emerald-900/20 transition active:scale-[0.97]"
                            onClick={() => handleChangeStatus(bench, "approved")}
                            aria-label="Approve bench"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-700/90 text-lg font-semibold text-white shadow-inner shadow-rose-900/30 transition active:scale-[0.97]"
                            onClick={() => handleDeleteBench(bench)}
                            aria-label="Delete bench"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {activeTab === "approved" && (
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/90 text-lg font-semibold text-white shadow-inner shadow-rose-900/30 transition active:scale-[0.97]"
                          onClick={() => handleChangeStatus(bench, "rejected")}
                          aria-label="Reject bench"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </article>
                ))}

              {!activeTabState.loading && activeTabState.items.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  {TAB_CONFIG[activeTab].empty}
                </div>
              )}

              {activeTabState.loadingMore && (
                <div className="py-4 text-center text-[11px] text-slate-400">
                  Loading more...
                </div>
              )}

              <div ref={sentinelRef} className="h-6 w-full" />
            </div>
          </div>
        )}
      </main>

      {isAdmin && (
        <footer className="border-t border-slate-800/80 bg-slate-950/90 px-3 py-3">
          <div className="mx-auto w-full max-w-[320px]">
            <div className="grid grid-cols-3 gap-1 rounded-full border border-slate-800/80 bg-slate-900/70 px-2 py-1.5">
              {(Object.keys(TAB_CONFIG) as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`h-11 rounded-full text-[11px] font-semibold tracking-wide transition ${
                    activeTab === tab
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => handleTabChange(tab)}
                >
                  {TAB_CONFIG[tab].label}
                </button>
              ))}
            </div>
          </div>
        </footer>
      )}

      {editingBench && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            onClick={closeEditDialog}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-800/80 bg-slate-900/95 p-4 shadow-2xl shadow-slate-950/70">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Editing submission
                  </p>
                  <div className="text-sm font-semibold text-slate-100">
                    {editingBench.description || "No description"}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {editingBench.latitude.toFixed(4)},{" "}
                    {editingBench.longitude.toFixed(4)}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 text-slate-200 transition hover:bg-slate-800/80 active:scale-95"
                  onClick={closeEditDialog}
                  aria-label="Close edit dialog"
                >
                  ✕
                </button>
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleEditingFilesSelected(event.target.files);
                  if (event.target) {
                    event.target.value = "";
                  }
                }}
              />

              <BenchEditorForm
                mode="edit"
                heading="Edit bench"
                locationInput={editingLocationInput}
                onLocationInputChange={handleEditingLocationChange}
                onLocationInputBlur={handleEditingLocationBlur}
                locationInputError={editingLocationError}
                locationPlaceholder={formatLatLngInput(
                  editingBench.latitude,
                  editingBench.longitude
                )}
                existingPhotoUrls={editingExistingPhotoUrls}
                onRemoveExistingPhoto={removeExistingEditPhoto}
                pendingFileList={editingPendingFiles}
                dragFromIndexRef={editingDragFromIndexRef}
                onReorderPendingPhoto={handleEditingMovePhoto}
                onRemovePendingPhoto={removePendingEditPhoto}
                onAddPhotoClick={() => editFileInputRef.current?.click()}
                description={editingDescription}
                onDescriptionChange={setEditingDescription}
                onCancel={closeEditDialog}
                onSubmit={handleEditingSubmit}
                submitLabels={{
                  idle: "Save changes",
                  submitting: "Saving...",
                }}
                canDelete={false}
                isSubmitting={editingSubmitting}
                submitError={editingSubmitError}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
