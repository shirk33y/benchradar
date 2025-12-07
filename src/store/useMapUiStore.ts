import { create } from "zustand";

export type AddMode = "idle" | "choosing-location" | "details";
export type AuthMode = "closed" | "signin";

export type MapUiState = {
  isMenuOpen: boolean;
  isAddOpen: boolean;
  addMode: AddMode;
  authMode: AuthMode;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  setAddOpen: (open: boolean) => void;
  toggleAdd: () => void;
  setAddMode: (mode: AddMode) => void;
  setAuthMode: (mode: AuthMode) => void;
};

export const useMapUiStore = create<MapUiState>(
  (
    set: (
      partial:
        | Partial<MapUiState>
        | ((state: MapUiState) => Partial<MapUiState>),
    ) => void,
  ) => ({
  isMenuOpen: false,
  isAddOpen: false,
  addMode: "idle",
  authMode: "closed",
  setMenuOpen: (open: boolean) => set({ isMenuOpen: open }),
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
  setAddOpen: (open: boolean) => set({ isAddOpen: open }),
  toggleAdd: () => set((state) => ({ isAddOpen: !state.isAddOpen })),
  setAddMode: (mode: AddMode) => set({ addMode: mode }),
  setAuthMode: (mode: AuthMode) => set({ authMode: mode }),
  }),
);
