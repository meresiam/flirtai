"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MonitoredProfileSummary } from "@/types/profile-watch";

interface ProfileLimits {
  perUser: number;
  currentCount: number;
}

interface ProfilesState {
  profiles: MonitoredProfileSummary[];
  selectedProfileId: string | null;
  limits: ProfileLimits;
  hasHydrated: boolean;
  isBootstrapping: boolean;
  bootstrapError: string | null;

  bootstrap: () => Promise<void>;
  addProfile: (profile: MonitoredProfileSummary) => void;
  removeProfile: (id: string) => void;
  patchProfile: (id: string, partial: Partial<MonitoredProfileSummary>) => void;
  selectProfile: (id: string | null) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useProfilesStore = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [],
      selectedProfileId: null,
      limits: { perUser: 3, currentCount: 0 },
      hasHydrated: false,
      isBootstrapping: false,
      bootstrapError: null,

      bootstrap: async () => {
        if (get().isBootstrapping) return;
        set({ isBootstrapping: true, bootstrapError: null });
        try {
          const response = await fetch("/api/profiles", { cache: "no-store" });
          if (response.status === 401) {
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            set({ isBootstrapping: false });
            return;
          }
          if (!response.ok) {
            throw new Error("Não consegui carregar seus perfis.");
          }
          const data = (await response.json()) as {
            profiles: MonitoredProfileSummary[];
            limits: ProfileLimits;
          };
          set({
            profiles: data.profiles,
            limits: data.limits,
            isBootstrapping: false,
          });
        } catch (error) {
          set({
            isBootstrapping: false,
            bootstrapError:
              error instanceof Error ? error.message : "Erro ao carregar perfis.",
          });
        }
      },

      addProfile: (profile) =>
        set((state) => ({
          profiles: [profile, ...state.profiles],
          limits: {
            ...state.limits,
            currentCount: state.limits.currentCount + 1,
          },
        })),

      removeProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          selectedProfileId:
            state.selectedProfileId === id ? null : state.selectedProfileId,
          limits: {
            ...state.limits,
            currentCount: Math.max(0, state.limits.currentCount - 1),
          },
        })),

      patchProfile: (id, partial) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...partial } : p,
          ),
        })),

      selectProfile: (id) => set({ selectedProfileId: id }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "flirt-profiles-store",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        selectedProfileId: state.selectedProfileId,
        limits: state.limits,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
