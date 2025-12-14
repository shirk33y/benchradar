import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import type { Bench } from "../store/useBenchStore";

type BenchPhotoRow = { url: string; is_main: boolean | null };

export type BenchAdminRow = Bench & {
  createdBy: string;
  createdAt: string;
  photoUrls: string[];
};

export const TAB_KEYS = ["pending", "rejected", "approved"] as const;

export type TabKey = (typeof TAB_KEYS)[number];

type TabMeta = { label: string; accent: string; empty: string };

export const TAB_CONFIG: Record<TabKey, TabMeta> = {
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

export function isTabKey(value: string | undefined): value is TabKey {
  if (!value) return false;
  return (TAB_KEYS as readonly string[]).includes(value);
}

type TabState = {
  items: BenchAdminRow[];
  loading: boolean;
  loadingMore: boolean;
  initialized: boolean;
  endReached: boolean;
  lastCursor: string | null;
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

type UseAdminTabsOptions = {
  onError?: (message: string | null) => void;
};

export function useAdminTabs(
  initialTab: TabKey,
  isAdmin: boolean,
  options?: UseAdminTabsOptions
) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [tabState, setTabState] = useState<Record<TabKey, TabState>>({
    pending: createInitialTabState(),
    rejected: createInitialTabState(),
    approved: createInitialTabState(),
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const tabStateRef = useRef(tabState);
  const onError = options?.onError;

  useEffect(() => {
    tabStateRef.current = tabState;
  }, [tabState]);

  const loadTabPage = useCallback(async (tab: TabKey) => {
    const state = tabStateRef.current[tab];
    if (state.loading || state.loadingMore || state.endReached) {
      return;
    }

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

    const { data, error } = await query;

    if (error) {
      onError?.("Loading benches failed.");
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

    onError?.(null);

    const mapped: BenchAdminRow[] =
      data?.map((row) => {
        const photos = (row.bench_photos as BenchPhotoRow[] | null) ?? [];
        const sortedPhotos = [...photos]
          .sort((a, b) => {
            if (a.is_main && !b.is_main) return -1;
            if (!a.is_main && b.is_main) return 1;
            return 0;
          })
          .map((p) => p.url)
          .filter((url): url is string => Boolean(url));
        const photoUrls =
          sortedPhotos.length > 0
            ? sortedPhotos
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
  }, []);

  const removeBenchFromTabs = useCallback((benchId: string) => {
    setTabState((prev) => {
      let changed = false;
      const next: Record<TabKey, TabState> = { ...prev };
      for (const tab of TAB_KEYS) {
        const exists = prev[tab].items.some((b) => b.id === benchId);
        if (exists) {
          changed = true;
          next[tab] = {
            ...prev[tab],
            items: prev[tab].items.filter((b) => b.id !== benchId),
          };
        }
      }
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

        for (const tab of TAB_KEYS) {
          const idx = prev[tab].items.findIndex((b) => b.id === benchId);
          if (idx !== -1) {
            changed = true;
            const updatedBench = updater(prev[tab].items[idx]);
            const newItems = [...prev[tab].items];
            newItems[idx] = updatedBench;
            next[tab] = { ...prev[tab], items: newItems };
          }
        }

        return changed ? next : prev;
      });
    },
    []
  );

  const pendingState = tabState.pending;
  const activeTabState = tabState[activeTab];

  useEffect(() => {
    if (!isAdmin) return;
    if (
      pendingState.initialized ||
      pendingState.loading ||
      pendingState.loadingMore
    ) {
      return;
    }
    void loadTabPage("pending");
  }, [
    isAdmin,
    loadTabPage,
    pendingState.initialized,
    pendingState.loading,
    pendingState.loadingMore,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "pending") return;
    if (
      activeTabState.initialized ||
      activeTabState.loading ||
      activeTabState.loadingMore
    ) {
      return;
    }
    void loadTabPage(activeTab);
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
    if (!activeTabState.initialized || activeTabState.endReached) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const currentState = tabStateRef.current[activeTab];
        if (
          entry.isIntersecting &&
          !currentState.loading &&
          !currentState.loadingMore &&
          !currentState.endReached
        ) {
          void loadTabPage(activeTab);
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
    isAdmin,
    loadTabPage,
  ]);

  return {
    activeTab,
    setActiveTab,
    tabState,
    activeTabState,
    pendingState,
    sentinelRef,
    loadTabPage,
    removeBenchFromTabs,
    insertBenchIntoTab,
    updateBenchInTabs,
  };
}
