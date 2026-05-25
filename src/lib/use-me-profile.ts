"use client";

import { useEffect, useState } from "react";

// WR-04 — hook compartilhado pro fetch de /api/me/profile.
// Cacheia em modulo (1 fetch por load do shell) pra evitar 2-3 requests
// duplicadas quando MeBannerCta + MeOnboardingModal montam juntos no
// flirt-ai-shell. O cache vive enquanto o tab estiver aberto; refetch()
// forca refresh apos PATCH/DELETE em /me ou apos finalizar onboarding.

export interface MeProfileLite {
  onboardingDone: boolean;
}

interface CacheEntry {
  data: MeProfileLite | null;
  fetchedAt: number;
  inflight: Promise<MeProfileLite | null> | null;
}

const cache: CacheEntry = {
  data: null,
  fetchedAt: 0,
  inflight: null,
};

// Listeners pra notificar todos os consumers quando o cache atualizar.
const listeners = new Set<(data: MeProfileLite | null) => void>();

function notify(data: MeProfileLite | null) {
  for (const l of listeners) l(data);
}

async function fetchMeProfile(
  signal?: AbortSignal,
): Promise<MeProfileLite | null> {
  if (cache.inflight) return cache.inflight;
  cache.inflight = (async () => {
    try {
      const response = await fetch("/api/me/profile", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return null;
      const { userProfile } = (await response.json()) as {
        userProfile: { onboardingDone: boolean };
      };
      const lite: MeProfileLite = { onboardingDone: userProfile.onboardingDone };
      cache.data = lite;
      cache.fetchedAt = Date.now();
      notify(lite);
      return lite;
    } catch (cause) {
      if ((cause as Error)?.name === "AbortError") return null;
      return null;
    } finally {
      cache.inflight = null;
    }
  })();
  return cache.inflight;
}

export function useMeProfile(): {
  profile: MeProfileLite | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  // Lazy init derivada do cache evita setState sincrono em useEffect
  // (react-hooks/set-state-in-effect). Quando cache ja tem data, comeca
  // direto com loading=false; caso contrario, useEffect dispara fetch.
  const [profile, setProfile] = useState<MeProfileLite | null>(() => cache.data);
  const [loading, setLoading] = useState<boolean>(() => cache.data === null);

  useEffect(() => {
    const ac = new AbortController();
    const listener = (data: MeProfileLite | null) => {
      setProfile(data);
      setLoading(false);
    };
    listeners.add(listener);

    if (!cache.data) {
      void fetchMeProfile(ac.signal).then((data) => {
        setProfile(data);
        setLoading(false);
      });
    }

    return () => {
      listeners.delete(listener);
      ac.abort();
    };
  }, []);

  return {
    profile,
    loading,
    refetch: async () => {
      cache.data = null;
      cache.fetchedAt = 0;
      await fetchMeProfile();
    },
  };
}
