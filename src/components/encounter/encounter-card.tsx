"use client";

import {
  TrendingDownIcon,
  TrendingUpIcon,
  MinusIcon,
  HelpCircleIcon,
  ThumbsUpIcon,
  AlertTriangleIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  EncounterRecord,
  EncounterEscalation,
  EncounterMood,
} from "@/types/flirt";

const ESCALATION_LABEL: Record<EncounterEscalation, string> = {
  regrediu: "Regrediu",
  estagnou: "Estagnou",
  avancou: "Avançou",
  indefinido: "Indefinido",
};

const MOOD_LABEL: Record<EncounterMood, string> = {
  leve: "Leve",
  tenso: "Tenso",
  intenso: "Intenso",
  frustrante: "Frustrante",
  neutro: "Neutro",
};

function escalationStyle(value: EncounterEscalation): string {
  if (value === "avancou") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (value === "regrediu") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (value === "estagnou") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-white/15 bg-white/[0.04] text-white/65";
}

function EscalationIcon({ value }: { value: EncounterEscalation }) {
  if (value === "avancou") return <TrendingUpIcon className="h-3.5 w-3.5" />;
  if (value === "regrediu") return <TrendingDownIcon className="h-3.5 w-3.5" />;
  if (value === "estagnou") return <MinusIcon className="h-3.5 w-3.5" />;
  return <HelpCircleIcon className="h-3.5 w-3.5" />;
}

function moodStyle(value: EncounterMood): string {
  if (value === "leve") return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  if (value === "intenso") return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
  if (value === "tenso" || value === "frustrante")
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-white/15 bg-white/[0.04] text-white/65";
}

function formatDate(iso: string): string {
  // WR-05: new Date("garbage") retorna Invalid Date sem throw, e
  // Intl.DateTimeFormat.format(invalidDate) devolve "Data Inválida" em pt-BR.
  // Checa NaN explicito antes pra fallback no ISO original (debugavel).
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EncounterCard({ encounter }: { encounter: EncounterRecord }) {
  const { extracted } = encounter;
  const isDegraded = extracted.degraded === true;
  // WR-04 — defensivo: serializer ja garante arrays, mas evita crash se algum
  // endpoint novo retornar shape raw direto do DB sem passar por toEncounterPayload.
  const greens = extracted.greenFlags ?? [];
  const reds = extracted.redFlags ?? [];
  const userPatterns = extracted.userRedPatterns ?? [];

  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <time
          dateTime={encounter.happenedAt}
          className="text-xs uppercase tracking-wider text-white/45"
        >
          {formatDate(encounter.happenedAt)}
        </time>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]",
              escalationStyle(extracted.escalation),
            )}
          >
            <EscalationIcon value={extracted.escalation} />
            {ESCALATION_LABEL[extracted.escalation]}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]",
              moodStyle(extracted.mood),
            )}
          >
            {MOOD_LABEL[extracted.mood]}
          </span>
        </div>
      </header>

      {isDegraded ? (
        <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/80">
          IA não conseguiu ler esse relato. Texto bruto preservado abaixo.
        </p>
      ) : null}

      {extracted.summary ? (
        <p className="mt-3 text-sm leading-relaxed text-white/85">
          {extracted.summary}
        </p>
      ) : null}

      {greens.length > 0 || reds.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {greens.length > 0 ? (
            <div className="rounded-lg bg-emerald-400/[0.06] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-300/80">
                <ThumbsUpIcon className="h-3 w-3" />
                Sinais positivos
              </p>
              <ul className="space-y-1 text-xs text-emerald-100/90">
                {greens.map((flag, idx) => (
                  <li key={`g-${idx}`}>· {flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {reds.length > 0 ? (
            <div className="rounded-lg bg-rose-400/[0.06] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-rose-300/80">
                <AlertTriangleIcon className="h-3 w-3" />
                Sinais de alerta
              </p>
              <ul className="space-y-1 text-xs text-rose-100/90">
                {reds.map((flag, idx) => (
                  <li key={`r-${idx}`}>· {flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {extracted.nextMove ? (
        <div className="mt-4 rounded-lg border-l-2 border-[#ff355d] bg-white/[0.02] py-2 pl-3 pr-2">
          <p className="text-[11px] uppercase tracking-wider text-[#ff8a9e]/70">
            Próximo passo
          </p>
          <p className="mt-0.5 text-sm text-white/80">{extracted.nextMove}</p>
        </div>
      ) : null}

      {userPatterns.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-amber-300/80">
            Padrão seu detectado nesse encontro
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-100/90">
            {userPatterns.map((pattern, idx) => (
              <li key={`up-${idx}`}>· {pattern}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-4 text-xs text-white/45">
        <summary className="cursor-pointer select-none transition hover:text-white/70">
          Ver relato bruto
        </summary>
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-white/70 leading-relaxed">
          {encounter.rawText}
        </p>
      </details>
    </article>
  );
}
