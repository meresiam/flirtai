"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  EMPTY_ANSWERS,
  answersToPayload,
  type OnboardingAnswers,
} from "@/lib/flirt/me-onboarding";
import { OnboardingWizard } from "@/components/me-onboarding-wizard";

export default function OnboardingPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish(skipped: boolean) {
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
        throw new Error(data.error ?? "Não consegui salvar o onboarding.");
      }
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 text-white">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-white/55">
          FlirtAI · Wingman
        </p>
        <h1 className="mt-2 font-heading text-3xl">Conta sobre você</h1>
        <p className="mt-1 text-sm text-white/55">
          6 perguntas rápidas pro coach parar de chutar. Tudo opcional, pode pular.
        </p>
      </header>

      <OnboardingWizard
        answers={answers}
        onChange={setAnswers}
        onFinish={() => void handleFinish(false)}
        onSkip={() => void handleFinish(true)}
        disabled={submitting}
      />

      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </main>
  );
}
