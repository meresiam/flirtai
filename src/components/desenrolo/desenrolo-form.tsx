"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { LoaderIcon, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/contact-avatar";
import {
  RATING_DIMENSIONS,
  RATING_LABELS,
  type ContactRatings,
  type RatingDimension,
} from "@/types/flirt";

export interface DesenroloFormValues {
  name: string;
  avatarUrl: string;
  ratings: ContactRatings;
  location: string;
  metContext: string;
  source: string;
  instagramHandle: string;
  age: number | null;
  tags: string[];
  notes: string;
}

const EMPTY_RATINGS: ContactRatings = {
  beleza: null,
  inteligencia: null,
  lealdade: null,
  respeito: null,
  vestimenta: null,
};

export const EMPTY_FORM: DesenroloFormValues = {
  name: "",
  avatarUrl: "",
  ratings: { ...EMPTY_RATINGS },
  location: "",
  metContext: "",
  source: "Instagram",
  instagramHandle: "",
  age: null,
  tags: [],
  notes: "",
};

function computePadrao(ratings: ContactRatings): number | null {
  const values = Object.values(ratings).filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

interface DesenroloFormProps {
  initial?: Partial<DesenroloFormValues>;
  submitLabel?: string;
  busyLabel?: string;
  onSubmit: (values: DesenroloFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

export function DesenroloForm({
  initial,
  submitLabel = "Salvar perfil",
  busyLabel = "Salvando...",
  onSubmit,
  onCancel,
}: DesenroloFormProps) {
  const [values, setValues] = useState<DesenroloFormValues>({
    ...EMPTY_FORM,
    ...initial,
    ratings: { ...EMPTY_RATINGS, ...(initial?.ratings ?? {}) },
  });
  const [tagDraft, setTagDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const padrao = useMemo(() => computePadrao(values.ratings), [values.ratings]);

  function update<K extends keyof DesenroloFormValues>(
    key: K,
    value: DesenroloFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setRating(dim: RatingDimension, value: number | null) {
    setValues((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [dim]: value },
    }));
  }

  function addTag() {
    const trimmed = tagDraft.trim();
    if (!trimmed) return;
    if (values.tags.length >= 12) return;
    if (values.tags.includes(trimmed)) {
      setTagDraft("");
      return;
    }
    update("tags", [...values.tags, trimmed]);
    setTagDraft("");
  }

  function removeTag(tag: string) {
    update(
      "tags",
      values.tags.filter((t) => t !== tag),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setErrorMessage("Dá um nome pra ela pelo menos.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        avatarUrl: values.avatarUrl.trim(),
        location: values.location.trim(),
        metContext: values.metContext.trim(),
        source: values.source.trim() || "Instagram",
        instagramHandle: values.instagramHandle.trim(),
        notes: values.notes.trim(),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não consegui salvar agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const padraoDisplay = padrao === null ? "—" : padrao.toFixed(1);
  const filledDimensions = Object.values(values.ratings).filter(
    (v) => v !== null,
  ).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hero: avatar + nome */}
      <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 sm:flex-row sm:items-start sm:gap-7">
        <div className="flex flex-col items-center gap-3">
          <ContactAvatar
            name={values.name || "?"}
            src={values.avatarUrl}
            className="h-28 w-28 ring-2 ring-white/10"
            sizes="112px"
          />
          <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
            Foto (URL)
          </label>
          <div className="relative w-full sm:w-56">
            <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              type="url"
              value={values.avatarUrl}
              onChange={(e) => update("avatarUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-white/[0.07] bg-black/30 py-2 pl-9 pr-3 text-xs text-white outline-none transition focus:border-[#ff355d]/40"
            />
          </div>
        </div>

        <div className="flex-1">
          <Field label="Nome" required>
            <input
              type="text"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Como você chama ela"
              maxLength={120}
              className="w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-base text-white outline-none transition focus:border-[#ff355d]/40"
              autoFocus
            />
          </Field>
        </div>
      </div>

      {/* Padrão — 5 dimensões + média */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-heading text-base font-semibold text-white">
              Padrão
            </h3>
            <p className="mt-0.5 text-[11px] text-white/40">
              Sua nota dela em 5 dimensões. Média {filledDimensions
                ? `de ${filledDimensions} preenchida(s)`
                : "calculada quando você avaliar"}.
            </p>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-xl bg-[#ff355d]/15 px-3 py-1.5">
            <span className="font-mono text-3xl font-semibold text-[#ff8a9e] tabular-nums">
              {padraoDisplay}
            </span>
            <span className="text-xs text-[#ff8a9e]/70">/ 10</span>
          </div>
        </div>

        <div className="space-y-3">
          {RATING_DIMENSIONS.map((dim) => (
            <RatingRow
              key={dim}
              label={RATING_LABELS[dim]}
              value={values.ratings[dim]}
              onChange={(v) => setRating(dim, v)}
            />
          ))}
        </div>

        <p className="mt-4 text-[11px] text-white/35">
          IA continua lendo o interesse dela nas conversas separadamente —
          esses números são só seus.
        </p>
      </div>

      {/* Contexto */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Onde conheceu" hint='Ex: "Tinder", "Festa do Lucas", "Trabalho", "Bar"'>
          <input
            type="text"
            value={values.metContext}
            onChange={(e) => update("metContext", e.target.value)}
            placeholder="Tinder, festa, app..."
            maxLength={240}
            className="w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
          />
        </Field>

        <Field label="Localização" hint='Cidade ou bairro: "SP · Vila Madalena"'>
          <input
            type="text"
            value={values.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="São Paulo · Pinheiros"
            maxLength={160}
            className="w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
          />
        </Field>

        <Field label="Plataforma">
          <input
            type="text"
            value={values.source}
            onChange={(e) => update("source", e.target.value)}
            placeholder="Instagram"
            maxLength={120}
            className="w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
          />
        </Field>

        <Field label="@ do Instagram" hint="Sem o @">
          <input
            type="text"
            value={values.instagramHandle}
            onChange={(e) => update("instagramHandle", e.target.value.replace(/^@/, ""))}
            placeholder="nome.dela"
            maxLength={120}
            className="w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
          />
        </Field>

        <Field label="Idade">
          <input
            type="number"
            inputMode="numeric"
            value={values.age ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              update("age", val === "" ? null : Number(val));
            }}
            min={13}
            max={120}
            placeholder="24"
            className="w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
          />
        </Field>
      </div>

      {/* Tags */}
      <Field
        label="Tags"
        hint="Aperta Enter pra adicionar. Ex: 'tatuada', 'baladeira', 'viajante'"
      >
        <div className="flex flex-wrap gap-2 rounded-lg border border-white/[0.07] bg-black/30 p-3">
          {values.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ff355d]/15 px-3 py-1 text-xs text-[#ff8a9e]"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remover ${tag}`}
                className="text-[#ff8a9e]/70 transition hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              } else if (e.key === "Backspace" && !tagDraft && values.tags.length) {
                update("tags", values.tags.slice(0, -1));
              }
            }}
            onBlur={addTag}
            placeholder={
              values.tags.length === 0
                ? "Digita e aperta Enter..."
                : values.tags.length >= 12
                ? "Limite de 12 tags"
                : "+ tag"
            }
            disabled={values.tags.length >= 12}
            className="min-w-[120px] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
      </Field>

      {/* Notes */}
      <Field label="Notas livres" hint="Tudo que você quer lembrar dela (privado, só você vê)">
        <textarea
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Lembrar que ela falou do cachorro Bento. Adora vinho. Está em transição de trampo..."
          rows={4}
          maxLength={2000}
          className="w-full resize-none rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#ff355d]/40"
        />
      </Field>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting || !values.name.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#ff355d] px-6 text-sm font-medium text-white transition hover:bg-[#ff355d]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <LoaderIcon className="h-4 w-4 animate-spin" />
              {busyLabel}
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const display = value === null ? "—" : value.toFixed(1);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-medium text-white/65 sm:w-28">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={value ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "flex-1 accent-[#ff355d]",
          value === null && "opacity-50",
        )}
        aria-label={label}
      />
      <span
        className={cn(
          "w-10 text-right font-mono text-sm tabular-nums",
          value === null ? "text-white/30" : "text-white",
        )}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label={`Limpar ${label}`}
        disabled={value === null}
        className="rounded p-1 text-white/30 transition hover:bg-white/[0.05] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ×
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline gap-1 text-xs font-medium uppercase tracking-wider text-white/55">
        {label}
        {required ? <span className="text-[#ff355d]">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-white/35">{hint}</span> : null}
    </label>
  );
}
