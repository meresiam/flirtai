"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  HeartIcon,
  MapPinIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  UserCircle2Icon,
} from "lucide-react";

import {
  COACH_TONE_OPTIONS,
  CONTEXT_LIFE_OPTIONS,
  RELATIONSHIP_OPTIONS,
  type CoachToneId,
  type ContextLifeId,
  type RelationshipId,
} from "@/lib/flirt/me-onboarding";

interface Demographics {
  relationship?: RelationshipId;
  kids?: number;
}

interface MeProfile {
  tone: CoachToneId | null;
  age: number | null;
  locationCity: string | null;
  contextLife: ContextLifeId | null;
  demographics: Demographics | null;
  winSamples: string[];
  redPatternsRaw: string[];
  redPatterns: string[];
  onboardingDone: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MePage() {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tone, setTone] = useState<CoachToneId | "">("");
  const [age, setAge] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [contextLife, setContextLife] = useState<ContextLifeId | "">("");
  const [relationship, setRelationship] = useState<RelationshipId | "">("");
  const [kids, setKids] = useState("");

  useEffect(() => {
    // WR-03 — AbortController real em vez de flag implicita. Em StrictMode
    // dev double-mount a primeira request e abortada antes da segunda.
    const ac = new AbortController();
    void load();
    return () => ac.abort();

    async function load() {
      try {
        const response = await fetch("/api/me/profile", {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!response.ok) throw new Error("Não consegui carregar seu perfil.");
        const { userProfile } = (await response.json()) as { userProfile: MeProfile };
        applyProfile(userProfile);
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Erro ao carregar.");
      } finally {
        setLoading(false);
      }
    }
  }, []);

  function applyProfile(payload: MeProfile) {
    setProfile(payload);
    setTone(payload.tone ?? "");
    setAge(payload.age != null ? String(payload.age) : "");
    setLocationCity(payload.locationCity ?? "");
    setContextLife(payload.contextLife ?? "");
    setRelationship(payload.demographics?.relationship ?? "");
    setKids(
      payload.demographics?.kids != null ? String(payload.demographics.kids) : "",
    );
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const ageNum = age.trim() ? Number(age.trim()) : null;
      const kidsNum = kids.trim() ? Number(kids.trim()) : null;
      if (ageNum != null && (!Number.isInteger(ageNum) || ageNum < 14 || ageNum > 120)) {
        throw new Error("Idade precisa estar entre 14 e 120.");
      }
      if (kidsNum != null && (!Number.isInteger(kidsNum) || kidsNum < 0)) {
        throw new Error("Filhos não pode ser negativo.");
      }
      const demographics: Demographics = {};
      if (relationship) demographics.relationship = relationship;
      if (kidsNum != null) demographics.kids = kidsNum;

      const payload = {
        tone: tone || null,
        age: ageNum,
        locationCity: locationCity.trim() || null,
        contextLife: contextLife || null,
        demographics: Object.keys(demographics).length ? demographics : null,
      };

      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui salvar.");
      }
      const { userProfile } = (await response.json()) as { userProfile: MeProfile };
      applyProfile(userProfile);
      setSuccess("Perfil atualizado.");
      window.setTimeout(() => setSuccess(null), 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearMemory() {
    if (
      !confirm(
        "Isso apaga tudo que o coach guardou sobre você (perfil, sugestões que funcionaram e padrões a evitar). Não tem volta. Tem certeza?",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/me/profile", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui limpar a memória.");
      }
      const { userProfile } = (await response.json()) as { userProfile: MeProfile };
      applyProfile(userProfile);
      setSuccess("Memória limpa.");
      window.setTimeout(() => setSuccess(null), 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao limpar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 text-white">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar ao chat
        </Link>
        {profile && !profile.onboardingDone ? (
          <Link
            href="/me/onboarding"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[#ff355d]/20 px-3 py-1.5 text-xs font-medium text-[#ff355d] transition hover:bg-[#ff355d]/30"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            Fazer onboarding guiado
          </Link>
        ) : null}
      </div>

      <h1 className="font-heading text-3xl">Sobre você</h1>
      <p className="mt-1 text-sm text-white/55">
        O coach usa isso pra parar de chutar e dar conselho calibrado pro seu contexto.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-white/55">Carregando...</p>
      ) : (
        <div className="mt-8 space-y-6">
          <SectionCard
            icon={<UserCircle2Icon className="h-4 w-4 text-[#ff355d]" aria-hidden="true" />}
            title="Quem é você"
            description="Quanto mais o coach souber, mais útil ele é. Tudo é opcional."
          >
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Idade">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={14}
                    max={120}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder="27"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(event) => setLocationCity(event.target.value)}
                    placeholder="São Paulo"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                  />
                </Field>
              </div>
              <Field label="Contexto de vida">
                <select
                  value={contextLife}
                  onChange={(event) =>
                    setContextLife(event.target.value as ContextLifeId | "")
                  }
                  className="mt-2 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                >
                  <option value="" className="bg-[#0a0d18]">
                    Não dizer
                  </option>
                  {CONTEXT_LIFE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#0a0d18] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Estado civil">
                  <select
                    value={relationship}
                    onChange={(event) =>
                      setRelationship(event.target.value as RelationshipId | "")
                    }
                    className="mt-2 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                  >
                    <option value="" className="bg-[#0a0d18]">
                      Não dizer
                    </option>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-[#0a0d18] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Filhos">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20}
                    value={kids}
                    onChange={(event) => setKids(event.target.value)}
                    placeholder="0"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                  />
                </Field>
              </div>

              <fieldset className="space-y-2 pt-2">
                <legend className="text-xs uppercase tracking-[0.18em] text-white/65">
                  Tom preferido (override do default em /settings)
                </legend>
                <div className="grid grid-cols-1 gap-2">
                  {COACH_TONE_OPTIONS.map((opt) => {
                    const checked = tone === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex min-h-[64px] cursor-pointer items-start gap-3 rounded-2xl border p-4 transition focus-within:border-[#ff355d]/60 ${
                          checked
                            ? "border-[#ff355d]/60 bg-[#ff355d]/[0.08]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/25"
                        }`}
                      >
                        <input
                          type="radio"
                          name="meTone"
                          value={opt.id}
                          checked={checked}
                          onChange={() => setTone(opt.id)}
                          className="mt-1 h-4 w-4 accent-[#ff355d]"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{opt.label}</p>
                          <p className="mt-1 text-xs text-white/55">{opt.description}</p>
                        </div>
                      </label>
                    );
                  })}
                  {tone ? (
                    <button
                      type="button"
                      onClick={() => setTone("")}
                      className="text-left text-xs text-white/45 underline decoration-dotted underline-offset-4 transition hover:text-white/75"
                    >
                      Usar o tom default de /settings
                    </button>
                  ) : null}
                </div>
              </fieldset>

              <PrimaryButton type="submit" disabled={saving}>
                Salvar perfil
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard
            icon={<HeartIcon className="h-4 w-4 text-emerald-300" aria-hidden="true" />}
            title="O que funcionou pra você"
            description="Sugestões marcadas como [Funcionou] no chat. O coach reaproveita o estilo."
          >
            {profile?.winSamples.length ? (
              <ul className="space-y-2">
                {profile.winSamples.slice(-20).reverse().map((sample, i) => (
                  <li
                    key={`win-${i}`}
                    className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] px-4 py-3 text-sm text-white/85"
                  >
                    {sample}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint>
                Ainda nada por aqui. Marque sugestões como [Funcionou] no chat pra alimentar.
              </EmptyHint>
            )}
          </SectionCard>

          <SectionCard
            icon={<ShieldAlertIcon className="h-4 w-4 text-amber-300" aria-hidden="true" />}
            title="Padrões a evitar"
            description="Feedbacks negativos guardados pro coach calibrar. Consolidação automática em release futura."
          >
            {profile?.redPatterns.length ? (
              <ul className="space-y-2">
                {profile.redPatterns.slice(-20).reverse().map((pattern, i) => (
                  <li
                    key={`red-${i}`}
                    className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-sm text-white/85"
                  >
                    {pattern}
                  </li>
                ))}
              </ul>
            ) : profile?.redPatternsRaw.length ? (
              <EmptyHint>
                {profile.redPatternsRaw.length} feedback(s) negativo(s) registrado(s) — vão virar padrões consolidados em breve.
              </EmptyHint>
            ) : (
              <EmptyHint>Sem nada por aqui. Quando algo não funcionar, marque pra avisar o coach.</EmptyHint>
            )}
          </SectionCard>

          <SectionCard
            icon={<MapPinIcon className="h-4 w-4 text-white/55" aria-hidden="true" />}
            title="Memória do coach"
            description="LGPD: você pode apagar tudo a qualquer momento. Esta ação não tem volta."
          >
            <button
              type="button"
              onClick={handleClearMemory}
              disabled={saving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-rose-300/30 bg-rose-300/[0.06] px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-300/[0.12] disabled:opacity-50"
            >
              <Trash2Icon className="h-4 w-4" />
              Limpar memória
            </button>
          </SectionCard>

          {error ? (
            <p role="alert" className="text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="text-sm text-emerald-200">
              {success}
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="liquid-panel rounded-[24px] border border-white/10 p-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-heading text-lg">{title}</h2>
      </div>
      {description ? (
        <p className="mt-1 text-sm text-white/55">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-white/65">{label}</span>
      {children}
    </label>
  );
}

function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0A0A0B] transition disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/45">
      {children}
    </p>
  );
}
