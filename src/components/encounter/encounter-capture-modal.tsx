"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderIcon } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { EncounterRecord } from "@/types/flirt";

const MIN_CHARS = 5;
const MAX_CHARS = 4000;

interface SubmitResult {
  encounter: EncounterRecord;
  degraded: boolean;
  degradedReason?: string;
}

export interface EncounterCaptureModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  contactName: string;
  onSubmit: (payload: { rawText: string; happenedAt: string }) => Promise<SubmitResult>;
}

function toLocalInputValue(date: Date): string {
  // datetime-local exige YYYY-MM-DDTHH:mm sem timezone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EncounterCaptureModal({
  open,
  onOpenChange,
  contactName,
  onSubmit,
}: EncounterCaptureModalProps) {
  const [rawText, setRawText] = useState("");
  const [happenedAt, setHappenedAt] = useState(() => toLocalInputValue(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setRawText("");
      setHappenedAt(toLocalInputValue(new Date()));
      setError(null);
      setDegradedNotice(null);
      // Foco no textarea ao abrir (Nielsen H7).
      const handle = window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 80);
      return () => window.clearTimeout(handle);
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = rawText.trim();
    if (trimmed.length < MIN_CHARS) {
      setError(`Conta um pouco mais (mín. ${MIN_CHARS} caracteres).`);
      return;
    }

    const localDate = new Date(happenedAt);
    if (Number.isNaN(localDate.getTime())) {
      setError("Data inválida.");
      return;
    }
    if (localDate.getTime() > Date.now() + 60_000) {
      setError("Data do encontro não pode ser no futuro.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setDegradedNotice(null);

    try {
      const result = await onSubmit({
        rawText: trimmed,
        happenedAt: localDate.toISOString(),
      });
      if (result.degraded) {
        setDegradedNotice(
          result.degradedReason
            ? `Texto guardado. IA não conseguiu ler agora (${result.degradedReason}).`
            : "Texto guardado. IA não conseguiu ler agora — vou tentar de novo na próxima.",
        );
        // Mantem modal aberto pra usuario ver o aviso, mas com submit habilitado pra fechar.
      } else {
        onOpenChange(false);
      }
    } catch (cause) {
      const msg =
        cause instanceof Error ? cause.message : "Não consegui salvar agora.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  }

  const charCount = rawText.trim().length;
  const tooShort = charCount > 0 && charCount < MIN_CHARS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden border-white/10 bg-[#0a0d18] p-0 text-white sm:rounded-3xl"
        showCloseButton
      >
        <div className="border-b border-white/[0.06] px-6 pt-6 pb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
            Diário de campo
          </p>
          <h2 className="mt-2 font-heading text-2xl">
            Como foi com {contactName.split(" ")[0] || "ela"}?
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Texto livre. Conta como foi — eu extraio os sinais e atualizo o perfil.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <label htmlFor="encounter-happened-at" className="mb-2 block text-xs uppercase tracking-wider text-white/45">
            Quando rolou?
          </label>
          <input
            id="encounter-happened-at"
            type="datetime-local"
            value={happenedAt}
            onChange={(event) => setHappenedAt(event.target.value)}
            disabled={submitting}
            className="mb-5 block w-full min-h-[44px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#ff355d]/40 focus:bg-white/[0.06]"
          />

          <label htmlFor="encounter-raw" className="mb-2 block text-xs uppercase tracking-wider text-white/45">
            O relato
          </label>
          <textarea
            ref={textareaRef}
            id="encounter-raw"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            maxLength={MAX_CHARS}
            rows={10}
            placeholder="Conta como foi. Onde, como ela tava, o que rolou, o que tu sentiu. Sem filtro."
            className="block min-h-[200px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/30 focus:border-[#ff355d]/40 focus:bg-white/[0.06]"
          />

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={tooShort ? "text-amber-300/80" : "text-white/40"}>
              {charCount}/{MAX_CHARS} caracteres
              {tooShort ? ` · mínimo ${MIN_CHARS}` : ""}
            </span>
            <span className="text-white/35 hidden sm:inline">⌘+Enter envia</span>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {degradedNotice ? (
            <p role="status" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {degradedNotice}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] bg-[#080b14] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {degradedNotice ? "Fechar" : "Cancelar"}
          </button>
          {!degradedNotice ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || charCount < MIN_CHARS}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#ff355d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#ff355d]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar encontro"
              )}
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
