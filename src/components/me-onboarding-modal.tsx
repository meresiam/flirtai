"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import {
  EMPTY_ANSWERS,
  answersToPayload,
  type OnboardingAnswers,
} from "@/lib/flirt/me-onboarding";
import { OnboardingWizard } from "@/components/me-onboarding-wizard";

// W6 — modal auto-abre na 1ª visita pós-signup.
// Critério: GET /api/me/profile retorna onboardingDone=false E não há
// localStorage `me-onboarding-modal-dismissed` (sessão atual).
// Após dismiss/finish, marca sessão-storage pra não reabrir no F5.
// Persistente entre sessões só pelo onboardingDone do server.

const SESSION_DISMISS_KEY = "me-onboarding-modal-dismissed";

export function MeOnboardingModal() {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load();
    return () => {
      cancelled = true;
    };

    async function load() {
      try {
        if (window.sessionStorage.getItem(SESSION_DISMISS_KEY)) return;
        const response = await fetch("/api/me/profile", { cache: "no-store" });
        if (cancelled || !response.ok) return;
        const { userProfile } = (await response.json()) as {
          userProfile: { onboardingDone: boolean };
        };
        if (!cancelled && !userProfile.onboardingDone) {
          setOpen(true);
        }
      } catch {
        // silencioso
      }
    }
  }, []);

  async function persist(skipped: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = skipped
        ? { skipped: true }
        : { ...answersToPayload(answers), skipped: false };
      const response = await fetch("/api/me/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui salvar.");
      }
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismissOnly() {
    // Fecha o modal sem persistir (volta abrir em próxima sessão se onboardingDone=false).
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismissOnly();
      }}
    >
      <DialogContent
        className="flex max-h-[92vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden border-white/10 bg-[#0a0d18] p-0 text-white sm:rounded-3xl"
        showCloseButton
      >
        <div className="border-b border-white/[0.06] px-6 pt-6 pb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
            FlirtAI · Wingman
          </p>
          <h2 className="mt-2 font-heading text-2xl">Conta sobre você</h2>
          <p className="mt-1 text-sm text-white/55">
            6 perguntas rápidas. Sem isso, o coach chuta. Pode pular.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <OnboardingWizard
            answers={answers}
            onChange={setAnswers}
            onFinish={() => void persist(false)}
            onSkip={() => void persist(true)}
            disabled={submitting}
          />
          {error ? (
            <p role="alert" className="mt-4 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
