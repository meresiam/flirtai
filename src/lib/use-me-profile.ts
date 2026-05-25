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
  controller: AbortController | null;
}

const cache: CacheEntry = {
  data: null,
  fetchedAt: 0,
  inflight: null,
  controller: null,
};

// Listeners pra notificar todos os consumers quando o cache atualizar.
// Conta de listeners ativos serve pra decidir se podemos abortar com
// seguranca: enquanto algum consumer estiver montado, mantemos o fetch.
const listeners = new Set<(data: MeProfileLite | null) => void>();

function notify(data: MeProfileLite | null) {
  for (const l of listeners) l(data);
}

// W7.3 — AbortController unico por fetch in-flight, compartilhado entre
// consumers. Abortar so quando NENHUM consumer estiver montado, pra evitar
// status 0 (canceled) no DevTools/Sentry quando MeBannerCta desmonta mas
// MeOnboardingModal ainda precisa do dado.
async function fetchMeProfile(): Promise<MeProfileLite | null> {
  if (cache.inflight) return cache.inflight;
  const controller = new AbortController();
  cache.controller = controller;
  cache.inflight = (async () => {
    try {
      const response = await fetch("/api/me/profile", {
        cache: "no-store",
        signal: controller.signal,
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
      // AbortError nao e erro real — consumer desmontou antes da resposta.
      if ((cause as Error)?.name === "AbortError") return null;
      return null;
    } finally {
      cache.inflight = null;
      cache.controller = null;
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
    let active = true;
    const listener = (data: MeProfileLite | null) => {
      if (!active) return;
      setProfile(data);
      setLoading(false);
    };
    listeners.add(listener);

    if (!cache.data) {
      void fetchMeProfile().then((data) => {
        if (!active) return;
        setProfile(data);
        setLoading(false);
      });
    }

    return () => {
      active = false;
      listeners.delete(listener);
      // So aborta a request central quando todos os consumers desmontaram.
      // Evita o pattern "status 0 (canceled)" que poluia DevTools/Sentry
      // em navegacao rapida pos-signup/login (SMOKE-W7-DONE Bug #3).
      if (listeners.size === 0 && cache.controller) {
        cache.controller.abort();
      }
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
