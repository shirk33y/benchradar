import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Bench } from "./useBenchStore";

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

export type BenchAdminRow = Bench & {
  createdBy: string;
  createdAt: string;
  photoUrls: string[];
};

export type AdminTabState = {
  items: BenchAdminRow[];
  loading: boolean;
  loadingMore: boolean;
  initialized: boolean;
  endReached: boolean;
  lastCursor: string | null;
};

function createInitialTabState(): AdminTabState {
  return {
    items: [],
    loading: false,
    loadingMore: false,
    initialized: false,
    endReached: false,
    lastCursor: null,
  };
}

type AdminStoreActions = {
  setActiveTab: (tab: TabKey) => void;
  markLoading: (tab: TabKey, isInitial: boolean) => void;
  applyLoadedPage: (args: {
    tab: TabKey;
    items: BenchAdminRow[];
    isInitial: boolean;
    lastCursor: string | null;
    endReached: boolean;
  }) => void;
  clearLoading: (tab: TabKey) => void;
  removeBenchFromTabs: (benchId: string) => void;
  insertBenchIntoTab: (bench: BenchAdminRow, tab: TabKey) => void;
  updateBenchInTabs: (
    benchId: string,
    updater: (bench: BenchAdminRow) => BenchAdminRow,
  ) => void;
  reset: () => void;
};

type AdminStoreStateShape = {
  activeTab: TabKey;
  tabState: Record<TabKey, AdminTabState>;
  actions: AdminStoreActions;
};

export const useAdminStore = create<AdminStoreStateShape>()(
  immer((set) => ({
    activeTab: "pending" as TabKey,
    tabState: {
      pending: createInitialTabState(),
      rejected: createInitialTabState(),
      approved: createInitialTabState(),
    },
    actions: {
      setActiveTab: (tab: TabKey) =>
        set((state) => {
          state.activeTab = tab;
        }),

      markLoading: (tab: TabKey, isInitial: boolean) =>
        set((state) => {
          state.tabState[tab].loading = isInitial;
          state.tabState[tab].loadingMore = !isInitial;
        }),

      applyLoadedPage: (args: {
        tab: TabKey;
        items: BenchAdminRow[];
        isInitial: boolean;
        lastCursor: string | null;
        endReached: boolean;
      }) =>
        set((state) => {
          const { tab, items, isInitial, lastCursor, endReached } = args;
          const prevTab = state.tabState[tab];
          prevTab.items = isInitial ? items : [...prevTab.items, ...items];
          prevTab.loading = false;
          prevTab.loadingMore = false;
          prevTab.initialized = true;
          prevTab.lastCursor = lastCursor;
          prevTab.endReached = endReached;
        }),

      clearLoading: (tab: TabKey) =>
        set((state) => {
          state.tabState[tab].loading = false;
          state.tabState[tab].loadingMore = false;
        }),

      removeBenchFromTabs: (benchId: string) =>
        set((state) => {
          for (const tab of TAB_KEYS) {
            state.tabState[tab].items = state.tabState[tab].items.filter(
              (b) => b.id !== benchId,
            );
          }
        }),

      insertBenchIntoTab: (bench: BenchAdminRow, tab: TabKey) =>
        set((state) => {
          const current = state.tabState[tab];
          if (!current.initialized) return;
          current.items.unshift(bench);
        }),

      updateBenchInTabs: (
        benchId: string,
        updater: (bench: BenchAdminRow) => BenchAdminRow,
      ) =>
        set((state) => {
          for (const tab of TAB_KEYS) {
            const idx = state.tabState[tab].items.findIndex((b) => b.id === benchId);
            if (idx !== -1) {
              state.tabState[tab].items[idx] = updater(state.tabState[tab].items[idx]);
            }
          }
        }),

      reset: () =>
        set((state) => {
          state.activeTab = "pending";
          state.tabState.pending = createInitialTabState();
          state.tabState.rejected = createInitialTabState();
          state.tabState.approved = createInitialTabState();
        }),
    },
  })),
);

export type AdminStoreState = ReturnType<typeof useAdminStore.getState>;
