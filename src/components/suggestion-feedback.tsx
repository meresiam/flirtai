"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, Loader2Icon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

// W6 — botões inline [Funcionou] / [Não funcionou] em cada SuggestionCard.
// Sem classificador no MVP — POST grava raw, W8 consolida.
// Optimistic UI: pinta o rating antes da rede; reverte se falhar.

interface SuggestionFeedbackProps {
  messageId: string;
  suggestionIndex: number;
  disabled?: boolean;
}

type Status = "idle" | "sending" | "sent" | "error";
type Rating = "worked" | "didnt_work" | null;

export function SuggestionFeedback({
  messageId,
  suggestionIndex,
  disabled = false,
}: SuggestionFeedbackProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [rating, setRating] = useState<Rating>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // WR-03 — AbortController ref pra cancelar o POST se o componente
  // desmontar antes da resposta (tab close, route change).
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send(next: Rating) {
    // WR-02 — bloqueia novas chamadas apos sucesso pra evitar 3 POSTs em
    // paralelo com closure desatualizado (race no banco). O usuario decide
    // uma vez por turno; mudanca de ideia precisa de UI explicita (desfazer).
    if (!next || status === "sending" || status === "sent") return;
    const previous = rating;
    setRating(next);
    setStatus("sending");
    setErrorMsg(null);
    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/me/profile/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, suggestionIndex, rating: next }),
        signal: abortRef.current.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui registrar.");
      }
      setStatus("sent");
    } catch (cause) {
      if ((cause as Error).name === "AbortError") return;
      setRating(previous);
      setStatus("error");
      setErrorMsg(cause instanceof Error ? cause.message : "Erro.");
      window.setTimeout(() => setStatus("idle"), 2500);
    }
  }

  return (
    <div
      className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <FeedbackButton
          aria-label="Funcionou"
          active={rating === "worked"}
          disabled={disabled || status === "sending" || status === "sent"}
          onClick={(event) => {
            event.stopPropagation();
            void send("worked");
          }}
          tone="positive"
        >
          {status === "sending" && rating === "worked" ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : status === "sent" && rating === "worked" ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <ThumbsUpIcon className="h-3.5 w-3.5" />
          )}
          Funcionou
        </FeedbackButton>
        <FeedbackButton
          aria-label="Não funcionou"
          active={rating === "didnt_work"}
          disabled={disabled || status === "sending" || status === "sent"}
          onClick={(event) => {
            event.stopPropagation();
            void send("didnt_work");
          }}
          tone="negative"
        >
          {status === "sending" && rating === "didnt_work" ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : status === "sent" && rating === "didnt_work" ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <ThumbsDownIcon className="h-3.5 w-3.5" />
          )}
          Não rolou
        </FeedbackButton>
      </div>
      {status === "sent" ? (
        <span className="text-[10px] text-emerald-200/80">guardado</span>
      ) : status === "error" && errorMsg ? (
        <span className="text-[10px] text-rose-200/80">{errorMsg}</span>
      ) : null}
    </div>
  );
}

function FeedbackButton({
  active,
  tone,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
  tone: "positive" | "negative";
}) {
  const base =
    "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-50";
  const palette = active
    ? tone === "positive"
      ? "border-emerald-300/40 bg-emerald-300/[0.10] text-emerald-100"
      : "border-amber-300/40 bg-amber-300/[0.10] text-amber-100"
    : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white";
  return (
    <button {...props} className={`${base} ${palette}`}>
      {children}
    </button>
  );
}
