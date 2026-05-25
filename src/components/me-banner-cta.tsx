"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";

import { useMeProfile } from "@/lib/use-me-profile";

// W6 — banner CTA persistente. Aparece quando UserProfile.onboardingDone=false.
// Dismissable por 7d via localStorage (key `me-banner-dismissed-until`).
// Quando user clica em "Personalizar agora", abre /me/onboarding.
// WR-04 — fetch de /api/me/profile vem do useMeProfile() compartilhado.

const DISMISS_KEY = "me-banner-dismissed-until";
const DISMISS_DURATION_DAYS = 7;

export function MeBannerCta() {
  const { profile } = useMeProfile();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const until = window.localStorage.getItem(DISMISS_KEY);
    if (until && Number(until) > Date.now()) {
      setDismissed(true);
    }
  }, []);

  const shouldRender = !dismissed && profile != null && !profile.onboardingDone;

  function handleDismiss() {
    const until = Date.now() + DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
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
