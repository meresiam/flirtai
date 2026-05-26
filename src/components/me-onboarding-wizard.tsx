"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, SkipForwardIcon } from "lucide-react";

import {
  COACH_TONE_OPTIONS,
  CONTEXT_LIFE_OPTIONS,
  RELATIONSHIP_OPTIONS,
  type CoachToneId,
  type ContextLifeId,
  type OnboardingAnswers,
  type RelationshipId,
} from "@/lib/flirt/me-onboarding";

interface OnboardingWizardProps {
  answers: OnboardingAnswers;
  onChange: (next: OnboardingAnswers) => void;
  onFinish: () => void;
  onSkip: () => void;
  disabled?: boolean;
}

// W6 — wizard 6-steps reaproveitado por /me/onboarding e <MeOnboardingModal />.
// Cada step pode pular individualmente (campo opcional → próximo).
// "Pular tudo" (rodapé) fecha o wizard inteiro marcando onboardingDone=true sem preencher.

export function OnboardingWizard({
  answers,
  onChange,
  onFinish,
  onSkip,
  disabled = false,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        id: "age" as const,
        title: "Sua idade?",
        hint: "Calibra o tom e os exemplos. Opcional.",
        body: (
          <NumberStep
            value={answers.age}
            min={14}
            max={120}
            placeholder="27"
            onChange={(v) => onChange({ ...answers, age: v })}
          />
        ),
      },
      {
        id: "location" as const,
        title: "Cidade onde você mora",
        hint: "Pra entender contexto local e cultura. Opcional.",
        body: (
          <TextStep
            value={answers.locationCity ?? ""}
            placeholder="São Paulo"
            // Armazena o valor cru (com espaços) — o trim acontece só no payload.
            // Trimar a cada tecla comia o espaço antes da próxima palavra.
            onChange={(v) => onChange({ ...answers, locationCity: v })}
          />
        ),
      },
      {
        id: "context" as const,
        title: "Contexto de vida",
        hint: "Pode marcar mais de um — o que descreve sua rotina.",
        body: (
          <CheckboxStep
            value={answers.contextLife}
            options={CONTEXT_LIFE_OPTIONS as readonly { id: ContextLifeId; label: string }[]}
            onChange={(v) => onChange({ ...answers, contextLife: v })}
          />
        ),
      },
      {
        id: "relationship" as const,
        title: "Estado civil",
        hint: "Pro coach saber em que jogo você está. Opcional.",
        body: (
          <RadioStep
            value={answers.relationship}
            options={RELATIONSHIP_OPTIONS as readonly { id: RelationshipId; label: string }[]}
            onChange={(v) => onChange({ ...answers, relationship: v })}
          />
        ),
      },
      {
        id: "kids" as const,
        title: "Tem filhos?",
        hint: "Influencia logística e prioridade nas sugestões. Opcional.",
        body: (
          <NumberStep
            value={answers.kids}
            min={0}
            max={20}
            placeholder="0"
            onChange={(v) => onChange({ ...answers, kids: v })}
          />
        ),
      },
      {
        id: "tone" as const,
        title: "Como você quer que o coach soe?",
        hint: "Pode mudar depois em /me ou /settings.",
        body: (
          <ToneStep
            value={answers.tone}
            onChange={(v) => onChange({ ...answers, tone: v })}
          />
        ),
      },
    ],
    [answers, onChange],
  );

  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  function handleNext() {
    if (isLast) {
      onFinish();
      return;
    }
    setStep((s) => Math.min(s + 1, total - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="liquid-panel flex flex-1 flex-col rounded-[24px] border border-white/10 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-white/45">
          <span>
            Passo {step + 1} de {total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-2 text-xs text-white/45 transition hover:text-white/75 disabled:opacity-50"
          >
            <SkipForwardIcon className="h-3.5 w-3.5" />
            Pular tudo
          </button>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full bg-[#ff355d] transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1">
        <h2 className="font-heading text-2xl">{current.title}</h2>
        <p className="mt-1 text-sm text-white/55">{current.hint}</p>
        <div className="mt-6">{current.body}</div>
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={disabled || step === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 transition hover:border-white/25 disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Voltar
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={disabled}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0A0A0B] transition disabled:opacity-50"
        >
          {isLast ? "Concluir" : "Próximo"}
          {!isLast ? <ChevronRightIcon className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}

function NumberStep({
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  value: number | null;
  min: number;
  max: number;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (!raw) {
          onChange(null);
          return;
        }
        const num = Number(raw);
        onChange(Number.isFinite(num) ? num : null);
      }}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 text-lg outline-none transition focus:border-[#ff355d]/40"
    />
  );
}

function TextStep({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 text-lg outline-none transition focus:border-[#ff355d]/40"
    />
  );
}

function RadioStep<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: readonly { id: T; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = value === opt.id;
        return (
          <label
            key={opt.id}
            className={`flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${
              checked
                ? "border-[#ff355d]/60 bg-[#ff355d]/[0.08]"
                : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <span className="text-base font-medium text-white">{opt.label}</span>
            <input
              type="radio"
              name={`radio-${opt.id}`}
              value={opt.id}
              checked={checked}
              onChange={() => onChange(opt.id)}
              className="h-4 w-4 accent-[#ff355d]"
            />
          </label>
        );
      })}
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-white/45 underline decoration-dotted underline-offset-4 transition hover:text-white/75"
        >
          Limpar resposta
        </button>
      ) : null}
    </div>
  );
}

function CheckboxStep<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T[];
  options: readonly { id: T; label: string }[];
  onChange: (v: T[]) => void;
}) {
  function toggle(id: T) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = value.includes(opt.id);
        return (
          <label
            key={opt.id}
            className={`flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${
              checked
                ? "border-[#ff355d]/60 bg-[#ff355d]/[0.08]"
                : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <span className="text-base font-medium text-white">{opt.label}</span>
            <input
              type="checkbox"
              value={opt.id}
              checked={checked}
              onChange={() => toggle(opt.id)}
              className="h-4 w-4 rounded accent-[#ff355d]"
            />
          </label>
        );
      })}
      {value.length ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-white/45 underline decoration-dotted underline-offset-4 transition hover:text-white/75"
        >
          Limpar seleção
        </button>
      ) : null}
    </div>
  );
}

function ToneStep({
  value,
  onChange,
}: {
  value: CoachToneId | null;
  onChange: (v: CoachToneId | null) => void;
}) {
  return (
    <div className="space-y-2">
      {COACH_TONE_OPTIONS.map((opt) => {
        const checked = value === opt.id;
        return (
          <label
            key={opt.id}
            className={`flex min-h-[72px] cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              checked
                ? "border-[#ff355d]/60 bg-[#ff355d]/[0.08]"
                : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <input
              type="radio"
              name="tone"
              value={opt.id}
              checked={checked}
              onChange={() => onChange(opt.id)}
              className="mt-1 h-4 w-4 accent-[#ff355d]"
            />
            <div className="flex-1">
              <p className="text-base font-medium text-white">{opt.label}</p>
              <p className="mt-1 text-xs text-white/55">{opt.description}</p>
            </div>
          </label>
        );
      })}
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-white/45 underline decoration-dotted underline-offset-4 transition hover:text-white/75"
        >
          Usar a voz default (sem tom forçado)
        </button>
      ) : null}
    </div>
  );
}
