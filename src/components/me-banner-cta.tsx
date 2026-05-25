"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";

// W6 — banner CTA persistente. Aparece quando UserProfile.onboardingDone=false.
// Dismissable por 7d via localStorage (key `me-banner-dismissed-until`).
// Quando user clica em "Personalizar agora", abre /me/onboarding.

const DISMISS_KEY = "me-banner-dismissed-until";
const DISMISS_DURATION_DAYS = 7;

export function MeBannerCta() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // WR-03 — AbortController real em vez de flag `cancelled`. Em
    // StrictMode/dev double-mount, a primeira request e abortada antes
    // da segunda iniciar, evitando setState em componente unmounted +
    // vazamento de conexao.
    const ac = new AbortController();
    void load();
    return () => ac.abort();

    async function load() {
      try {
        const dismissedUntil = window.localStorage.getItem(DISMISS_KEY);
        if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
          return;
        }
        const response = await fetch("/api/me/profile", {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!response.ok) return;
        const { userProfile } = (await response.json()) as {
          userProfile: { onboardingDone: boolean };
        };
        if (!userProfile.onboardingDone) {
          setShouldRender(true);
        }
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        // silencioso — banner é não-essencial
      }
    }
  }, []);

  function handleDismiss() {
    const until = Date.now() + DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setShouldRender(false);
  }

  if (!shouldRender) return null;

  return (
    <div className="mb-2 flex items-start gap-3 rounded-2xl border border-[#ff355d]/30 bg-[#ff355d]/[0.08] px-4 py-3 text-sm">
      <SparklesIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff355d]" />
      <div className="flex-1">
        <p className="font-medium text-white">
          Conta sobre você pro coach parar de chutar.
        </p>
        <p className="mt-1 text-xs text-white/65">
          6 perguntas rápidas. Tudo opcional. O conselho fica calibrado pro seu contexto.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/me/onboarding"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A0A0B] transition hover:bg-white/90"
          >
            Personalizar agora
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65 transition hover:border-white/30 hover:text-white"
          >
            Lembrar em 7 dias
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fechar"
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.05] hover:text-white"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
