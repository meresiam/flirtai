"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BellIcon,
  GlobeIcon,
  KeyIcon,
  LogOutIcon,
  MessageCircleIcon,
  UserIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import {
  LOCALE_IDS,
  TIMEZONE_IDS,
  type LocaleId,
  type TimezoneId,
} from "@/lib/flirt/locale-options";

type CoachToneId = "low_key" | "direto" | "provocador";

type FrequencyId = "instant" | "daily" | "weekly";

interface NotificationPrefs {
  push: boolean;
  frequency: FrequencyId;
}

interface SettingsPayload {
  email: string;
  name: string | null;
  anthropicKeyMasked: string | null;
  anthropicKeySet: boolean;
  anthropicModel: string | null;
  defaultModel: string;
  timezone: string | null;
  locale: string | null;
  coachTone: CoachToneId | null;
  notificationPrefs: NotificationPrefs | null;
  defaults: {
    timezone: string;
    locale: string;
    notificationPrefs: NotificationPrefs;
  };
}

// WR-03 — labels amigáveis pros IDs canônicos importados de locale-options.
// IDs vivem em src/lib/flirt/locale-options.ts (fonte única back+front).
// Se LOCALE_IDS / TIMEZONE_IDS ganhar novo ID, TS força adicionar label aqui.
const TIMEZONE_LABELS: Record<TimezoneId, string> = {
  "America/Sao_Paulo": "São Paulo (UTC−3)",
  "America/Manaus": "Manaus (UTC−4)",
  "America/Belem": "Belém (UTC−3)",
  "America/Fortaleza": "Fortaleza (UTC−3)",
  "America/Recife": "Recife (UTC−3)",
  "America/Noronha": "Fernando de Noronha (UTC−2)",
  "America/New_York": "Nova York (UTC−5)",
  "America/Los_Angeles": "Los Angeles (UTC−8)",
  "Europe/London": "Londres (UTC+0)",
  "Europe/Lisbon": "Lisboa (UTC+0)",
  "Europe/Madrid": "Madri (UTC+1)",
};

const TIMEZONE_OPTIONS: Array<{ id: TimezoneId; label: string }> = TIMEZONE_IDS.map(
  (id) => ({ id, label: TIMEZONE_LABELS[id] }),
);

const LOCALE_LABELS: Record<LocaleId, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
  "es-ES": "Español (España)",
};

const LOCALE_OPTIONS: Array<{ id: LocaleId; label: string }> = LOCALE_IDS.map(
  (id) => ({ id, label: LOCALE_LABELS[id] }),
);

const COACH_TONE_OPTIONS: Array<{
  id: CoachToneId;
  label: string;
  description: string;
}> = [
  {
    id: "low_key",
    label: "Low-key",
    description: "Discreto, conciso. Quem está ocupado e responde no tempo dele.",
  },
  {
    id: "direto",
    label: "Direto",
    description: "Vai ao ponto. Convite claro, sem rodeio.",
  },
  {
    id: "provocador",
    label: "Provocador",
    description: "Tensão e teasing calibrado. Nunca grosseria.",
  },
];

const FREQUENCY_OPTIONS: Array<{ id: FrequencyId; label: string }> = [
  { id: "instant", label: "Instantâneo" },
  { id: "daily", label: "Resumo diário" },
  { id: "weekly", label: "Resumo semanal" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const [coachTone, setCoachTone] = useState<CoachToneId | "">("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [frequency, setFrequency] = useState<FrequencyId>("daily");

  useEffect(() => {
    void load();
    async function load() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) throw new Error("Não consegui carregar suas configurações.");
        const { settings: payload } = (await response.json()) as { settings: SettingsPayload };
        setSettings(payload);
        setName(payload.name ?? "");
        setModel(payload.anthropicModel ?? "");
        setTimezone(payload.timezone ?? payload.defaults.timezone);
        setLocale(payload.locale ?? payload.defaults.locale);
        setCoachTone(payload.coachTone ?? "");
        const prefs = payload.notificationPrefs ?? payload.defaults.notificationPrefs;
        setPushEnabled(prefs.push);
        setFrequency(prefs.frequency);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro ao carregar.");
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // WR-04 — retorna boolean pro caller poder reverter UI otimista (ex:
  // handleSaveCoachTone) quando o PATCH falha. Forms tradicionais (perfil,
  // conta, key, notificações) ignoram o retorno — só mostram setError().
  async function save(
    payload: Record<string, unknown>,
    successMessage = "Atualizado!",
  ): Promise<boolean> {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui salvar.");
      }
      const { settings: updated } = (await response.json()) as {
        settings: Partial<SettingsPayload>;
      };
      setSettings((current) => (current ? { ...current, ...updated } : current));
      setApiKey("");
      setSuccess(successMessage);
      window.setTimeout(() => setSuccess(null), 2000);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save({ name }, "Perfil atualizado.");
  }

  async function handleSaveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save(
      { timezone: timezone || null, locale: locale || null },
      "Conta atualizada.",
    );
  }

  async function handleSaveCoachTone(tone: CoachToneId | null) {
    // WR-04 — radio é optimistic: pinta o novo valor antes do PATCH. Se o
    // servidor falha, save() retorna false e a gente reverte pro valor
    // anterior pra UI não mentir ("Tom aplicado" + servidor com tom antigo).
    const previous = coachTone;
    setCoachTone(tone ?? "");
    const ok = await save(
      { coachTone: tone },
      tone ? `Tom "${tone}" aplicado.` : "Tom default restaurado.",
    );
    if (!ok) setCoachTone(previous);
  }

  async function handleSaveNotifications(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save(
      { notificationPrefs: { push: pushEnabled, frequency } },
      "Notificações atualizadas.",
    );
  }

  async function handleSaveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    await save({ anthropicApiKey: apiKey.trim(), anthropicModel: model.trim() || null });
  }

  async function handleClearKey() {
    if (!confirm("Remover sua key e voltar pra key padrão do servidor?")) return;
    await save({ anthropicApiKey: null, anthropicModel: null });
    setModel("");
  }

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
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
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-rose-300/40 hover:text-rose-200"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>

      <h1 className="font-heading text-3xl">Configurações</h1>
      <p className="mt-1 text-sm text-white/55">
        {settings ? settings.email : "—"}
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-white/55">Carregando...</p>
      ) : (
        <div className="mt-8 space-y-6">
          <SectionCard
            icon={<UserIcon className="h-4 w-4 text-[#ff355d]" aria-hidden="true" />}
            title="Perfil"
          >
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <Field label="Nome">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                />
              </Field>
              <PrimaryButton type="submit" disabled={saving}>
                Salvar perfil
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard
            icon={<GlobeIcon className="h-4 w-4 text-[#ff355d]" aria-hidden="true" />}
            title="Conta"
            description="Fuso e idioma do produto. Afetam formatação de datas e a UI no futuro."
          >
            <form onSubmit={handleSaveAccount} className="space-y-3">
              <Field label="Fuso horário">
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="mt-2 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#0a0d18] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Idioma">
                <select
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  className="mt-2 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40"
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#0a0d18] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <PrimaryButton type="submit" disabled={saving}>
                Salvar conta
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard
            icon={<MessageCircleIcon className="h-4 w-4 text-[#ff355d]" aria-hidden="true" />}
            title="Coach"
            description="Tom default do FLIRT A.I. Aplica nas próximas mensagens; vazio = voz padrão."
          >
            <fieldset className="space-y-2">
              <legend className="sr-only">Tom default do coach</legend>
              {COACH_TONE_OPTIONS.map((tone) => {
                const checked = coachTone === tone.id;
                return (
                  <label
                    key={tone.id}
                    className={`flex min-h-[64px] cursor-pointer items-start gap-3 rounded-2xl border p-4 transition focus-within:border-[#ff355d]/60 ${
                      checked
                        ? "border-[#ff355d]/60 bg-[#ff355d]/[0.08]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="coachTone"
                      value={tone.id}
                      checked={checked}
                      disabled={saving}
                      onChange={() => void handleSaveCoachTone(tone.id)}
                      className="mt-1 h-4 w-4 accent-[#ff355d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff355d]"
                      aria-describedby={`coach-tone-${tone.id}-desc`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{tone.label}</p>
                      <p
                        id={`coach-tone-${tone.id}-desc`}
                        className="mt-1 text-xs text-white/55"
                      >
                        {tone.description}
                      </p>
                    </div>
                  </label>
                );
              })}
              {coachTone ? (
                <button
                  type="button"
                  onClick={() => void handleSaveCoachTone(null)}
                  disabled={saving}
                  className="text-xs text-white/45 underline decoration-dotted underline-offset-4 transition hover:text-white/75"
                >
                  Voltar pra voz default (sem tom forçado)
                </button>
              ) : null}
            </fieldset>
          </SectionCard>

          <SectionCard
            icon={<BellIcon className="h-4 w-4 text-[#ff355d]" aria-hidden="true" />}
            title="Notificações"
            description="Push web ainda em construção — esta preferência é gravada e ativada automaticamente quando o canal subir."
          >
            <form onSubmit={handleSaveNotifications} className="space-y-4">
              <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-sm text-white">Notificações push</span>
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(event) => setPushEnabled(event.target.checked)}
                  className="h-5 w-5 accent-[#ff355d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff355d]"
                />
              </label>
              <Field label="Frequência">
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as FrequencyId)}
                  disabled={!pushEnabled}
                  className="mt-2 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-[#ff355d]/40 disabled:opacity-50"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#0a0d18] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <PrimaryButton type="submit" disabled={saving}>
                Salvar notificações
              </PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard
            icon={<KeyIcon className="h-4 w-4 text-[#ff355d]" aria-hidden="true" />}
            title="Anthropic API"
          >
            <p className="text-sm text-white/55">
              {settings?.anthropicKeySet
                ? `Usando sua key: ${settings.anthropicKeyMasked}`
                : "Usando key padrão do servidor."}
            </p>

            <form onSubmit={handleSaveKey} className="mt-4 space-y-3">
              <Field label="Nova API key (sobrescreve a anterior)">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none transition focus:border-[#ff355d]/40"
                />
              </Field>

              <Field label="Modelo (opcional)">
                <input
                  type="text"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={settings?.defaultModel ?? "claude-sonnet-4-6"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none transition focus:border-[#ff355d]/40"
                />
                <span className="mt-1 block text-xs text-white/45">
                  Padrão: {settings?.defaultModel ?? "claude-sonnet-4-6"}
                </span>
              </Field>

              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="submit" disabled={saving || !apiKey.trim()}>
                  Salvar key
                </PrimaryButton>
                {settings?.anthropicKeySet ? (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    disabled={saving}
                    className="min-h-[44px] rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 transition hover:border-rose-300/40 hover:text-rose-200"
                  >
                    Remover key personalizada
                  </button>
                ) : null}
              </div>
            </form>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
