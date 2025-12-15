import { useCallback, useEffect, useRef } from "react";

import type { Bench } from "../store/useBenchStore";
import {
  type AdminTabState,
  type BenchAdminRow,
  TAB_CONFIG,
  TAB_KEYS,
  type TabKey,
  useAdminStore,
} from "../store/useAdminStore";
import { fetchBenchesForAdminTab } from "../repositories/benchRepository";

type BenchPhotoRow = { url: string; is_main: boolean | null };

export { TAB_CONFIG, TAB_KEYS };
export type { BenchAdminRow, TabKey };
export { isTabKey } from "../store/useAdminStore";

const PAGE_SIZE = 12;

type UseAdminTabsOptions = {
  onError?: (message: string | null) => void;
};

type UseAdminTabsResult = {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  tabState: Record<TabKey, AdminTabState>;
  activeTabState: AdminTabState;
  pendingState: AdminTabState;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  loadTabPage: (tab: TabKey) => Promise<void>;
  removeBenchFromTabs: (benchId: string) => void;
  insertBenchIntoTab: (bench: BenchAdminRow, tab: TabKey) => void;
  updateBenchInTabs: (benchId: string, updater: (bench: BenchAdminRow) => BenchAdminRow) => void;
};

export function useAdminTabs(
  initialTab: TabKey,
  isAdmin: boolean,
  options?: UseAdminTabsOptions
): UseAdminTabsResult {
  const activeTab = useAdminStore((s) => s.activeTab);
  const setActiveTab = useAdminStore((s) => s.actions.setActiveTab);
  const tabState = useAdminStore((s) => s.tabState);
  const markLoading = useAdminStore((s) => s.actions.markLoading);
  const applyLoadedPage = useAdminStore((s) => s.actions.applyLoadedPage);
  const clearLoading = useAdminStore((s) => s.actions.clearLoading);
  const removeBenchFromTabs = useAdminStore((s) => s.actions.removeBenchFromTabs);
  const insertBenchIntoTab = useAdminStore((s) => s.actions.insertBenchIntoTab);
  const updateBenchInTabs = useAdminStore((s) => s.actions.updateBenchInTabs);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const tabStateRef = useRef(tabState);
  const onError = options?.onError;

  useEffect(() => {
    tabStateRef.current = tabState;
  }, [tabState]);

  useEffect(() => {
    if (activeTab !== initialTab) {
      setActiveTab(initialTab);
    }
  }, [activeTab, initialTab, setActiveTab]);

  const loadTabPage = useCallback(async (tab: TabKey) => {
    const state = tabStateRef.current[tab];
    if (state.loading || state.loadingMore || state.endReached) {
      return;
    }

    const isInitial = !state.initialized;

    markLoading(tab, isInitial);

    const { data, error } = await fetchBenchesForAdminTab({
      status: tab,
      cursor: state.lastCursor,
      limit: PAGE_SIZE,
    });

    if (error) {
      onError?.("Loading benches failed.");
      clearLoading(tab);
      return;
    }

    onError?.(null);

    const mapped: BenchAdminRow[] =
      (data ?? []).map((row: any) => {
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

    const nextCursor =
      mapped.length > 0 ? mapped[mapped.length - 1].createdAt : state.lastCursor;
    applyLoadedPage({
      tab,
      items: mapped,
      isInitial,
      lastCursor: nextCursor,
      endReached: mapped.length < PAGE_SIZE,
    });
  }, [applyLoadedPage, clearLoading, markLoading, onError]);

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
