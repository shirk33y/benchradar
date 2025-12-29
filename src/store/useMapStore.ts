import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { User } from "@supabase/supabase-js";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import type { FormEvent } from "react";

import { fetchUserRole } from "../repositories/benchRepository";
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithGoogle,
  signInWithPassword,
  signOut,
} from "../repositories/authRepository";

export type AddMode = "idle" | "choosing-location" | "details";
export type AuthMode = "closed" | "signin";

export type MapStoreState = {
  // UI state
  isMenuOpen: boolean;
  isAddOpen: boolean;
  addMode: AddMode;
  authMode: AuthMode;

  // Auth state
  user: User | null;
  isAdmin: boolean;
  authEmail: string;
  authPassword: string;
  authError: string | null;
  authLoading: boolean;

  // Map runtime
  map: LeafletMap | null;
  center: LatLngExpression;
  userLocation: LatLngExpression | null;

  // UI actions
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  setAddOpen: (open: boolean) => void;
  toggleAdd: () => void;
  setAddMode: (mode: AddMode) => void;
  setAuthMode: (mode: AuthMode) => void;

  // Auth actions
  initAuth: () => () => void;
  setAuthEmail: (value: string) => void;
  setAuthPassword: (value: string) => void;
  openSignIn: () => void;
  handleSignOut: () => Promise<void>;
  handleAuthSubmit: (e: FormEvent) => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;

  // Map actions
  setMap: (map: LeafletMap | null) => void;
  setCenter: (center: LatLngExpression) => void;
  setUserLocation: (loc: LatLngExpression | null) => void;
};

const DEFAULT_CENTER: LatLngExpression = [52.2297, 21.0122];

export const useMapStore = create<MapStoreState>()(
  immer((set) => ({
    user: null,
    isAdmin: false,
    authEmail: "",
    authPassword: "",
    authError: null,
    authLoading: false,

    map: null,
    center: DEFAULT_CENTER,
    userLocation: null,

    isMenuOpen: false,
    isAddOpen: false,
    addMode: "idle",
    authMode: "closed",
    setMenuOpen: (open: boolean) =>
      set((state) => {
        state.isMenuOpen = open;
        state.isAddOpen = open ? false : state.isAddOpen;
      }),
    toggleMenu: () =>
      set((state) => {
        const wasOpen = state.isMenuOpen;
        state.isMenuOpen = !wasOpen;
        state.isAddOpen = wasOpen ? state.isAddOpen : false;
      }),
    setAddOpen: (open: boolean) =>
      set((state) => {
        state.isAddOpen = open;
        state.isMenuOpen = open ? false : state.isMenuOpen;
      }),
    toggleAdd: () =>
      set((state) => {
        const wasOpen = state.isAddOpen;
        state.isAddOpen = !wasOpen;
        state.isMenuOpen = wasOpen ? state.isMenuOpen : false;
      }),
    setAddMode: (mode: AddMode) =>
      set((state) => {
        state.addMode = mode;
      }),
    setAuthMode: (mode: AuthMode) =>
      set((state) => {
        state.authMode = mode;
      }),

    initAuth: () => {
      let cancelled = false;

      void (async () => {
        let u: User | null = null;
        try {
          u = await getCurrentUser();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("initAuth.getCurrentUser failed", err);
          return;
        }
        if (cancelled) return;

        set((state) => {
          state.user = u;
        });

        if (!u) {
          set((state) => {
            state.isAdmin = false;
          });
          return;
        }

        const { role, error } = await fetchUserRole({ userId: u.id });
        if (cancelled) return;

        set((state) => {
          state.isAdmin = error ? false : role === "admin";
        });
      })();

      const { data: authListener } = onAuthStateChange(async (_event, session) => {
        if (cancelled) return;
        const nextUser = session?.user ?? null;

        set((state) => {
          state.user = nextUser;
        });

        if (!nextUser) {
          set((state) => {
            state.isAdmin = false;
          });
          return;
        }

        const { role, error } = await fetchUserRole({ userId: nextUser.id });
        if (cancelled) return;

        set((state) => {
          state.isAdmin = error ? false : role === "admin";
        });
      });

      return () => {
        cancelled = true;
        authListener.subscription.unsubscribe();
      };
    },

    setAuthEmail: (value: string) =>
      set((state) => {
        state.authEmail = value;
      }),

    setAuthPassword: (value: string) =>
      set((state) => {
        state.authPassword = value;
      }),

    openSignIn: () =>
      set((state) => {
        state.authError = null;
        state.authEmail = "";
        state.authPassword = "";
        state.authMode = "signin";
        state.isMenuOpen = false;
      }),

    handleSignOut: async () => {
      await signOut();
      set((state) => {
        state.user = null;
        state.isAdmin = false;
        state.isMenuOpen = false;
      });
    },

    handleAuthSubmit: async (e: FormEvent) => {
      e.preventDefault();

      set((state) => {
        state.authLoading = true;
        state.authError = null;
      });

      const { authEmail, authPassword } = useMapStore.getState();

      const { data, error } = await signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      set((state) => {
        if (error || !data.user) {
          state.authError = "Invalid email or password.";
        } else {
          state.user = data.user;
          state.authMode = "closed";
        }
        state.authLoading = false;
      });
    },

    handleGoogleSignIn: async () => {
      set((state) => {
        state.authError = null;
        state.authLoading = true;
      });

      const { error } = await signInWithGoogle({
        redirectTo: `${window.location.origin}`,
      });

      if (error) {
        set((state) => {
          state.authError = "Google sign-in failed. Please try again.";
          state.authLoading = false;
        });
      }
    },

    setMap: (map: LeafletMap | null) =>
      set((state) => {
        state.map = map;
      }),

    setCenter: (center: LatLngExpression) =>
      set((state) => {
        state.center = center;
      }),

    setUserLocation: (loc: LatLngExpression | null) =>
      set((state) => {
        state.userLocation = loc;
      }),
  })),
);
